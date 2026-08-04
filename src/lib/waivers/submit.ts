import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeExpiresOnYmd, isWaiverExpired } from "./expiration";
import {
  buildCanonicalSubmissionPayload,
  validateSubmissionDraft,
  type SubmissionDraft,
} from "./validation";
import {
  canonicalRequestHash,
  deriveCompletionTokenFromIdempotencyKey,
  getWaiverHmacSecret,
  hashPublicToken,
  hmacIpAddress,
  WAIVER_COMPLETION_TOKEN_TTL_MS,
} from "./tokens";

export type SubmitWaiverResult = {
  submissionId: string;
  publicToken: string | null;
  expiresOn: string;
  tokenExpiresAt: string;
  reusedExisting: boolean;
  signatureStoragePath?: string;
  documentStoragePath?: string;
};

export class WaiverSubmitError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WaiverSubmitError";
    this.code = code;
  }
}

type RpcOutcome = {
  outcome: string;
  submission_id?: string;
  expires_on?: string;
  token_expires_at?: string;
  signature_storage_path?: string;
  document_storage_path?: string;
  error_code?: string;
  error_message?: string;
};

export async function submitWaiver(options: {
  draft: SubmissionDraft;
  requestIp?: string | null;
  userAgent?: string | null;
  now?: Date;
}): Promise<SubmitWaiverResult> {
  if (!getWaiverHmacSecret()) {
    throw new WaiverSubmitError(
      "misconfigured",
      "Waiver HMAC secret is not configured",
    );
  }

  let draft: SubmissionDraft;
  try {
    draft = validateSubmissionDraft(options.draft);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid waiver submission";
    throw new WaiverSubmitError("validation", message);
  }

  const now = options.now ?? new Date();
  const signedAt = now.toISOString();
  const expiresOn = computeExpiresOnYmd(now);
  const tokenExpiresAt = new Date(
    now.getTime() + WAIVER_COMPLETION_TOKEN_TTL_MS,
  ).toISOString();

  const publicToken = deriveCompletionTokenFromIdempotencyKey(draft.idempotencyKey);
  const publicTokenHash = hashPublicToken(publicToken);
  const requestHash = canonicalRequestHash(buildCanonicalSubmissionPayload(draft));

  const payload = {
    idempotency_key: draft.idempotencyKey,
    request_hash: requestHash,
    public_token_hash: publicTokenHash,
    template_version_id: draft.templateVersionId,
    signed_at: signedAt,
    source: draft.source,
    signature_content_type: draft.signatureContentType,
    ip_hmac: hmacIpAddress(options.requestIp),
    user_agent: options.userAgent?.slice(0, 512) ?? null,
    signer: {
      first_name: draft.signer.firstName,
      last_name: draft.signer.lastName,
      email: draft.signer.email,
      phone: draft.signer.phone,
    },
    consent: {
      acknowledgedRisk: draft.consent.acknowledgedRisk,
      acknowledgedTerms: draft.consent.acknowledgedTerms,
      isLegalGuardian: draft.consent.isLegalGuardian,
    },
    participants: draft.participants.map((participant) => ({
      temp_id: participant.tempId,
      first_name: participant.firstName,
      last_name: participant.lastName,
      dob: participant.dob,
      role: participant.role,
      guardian_temp_id: participant.guardianTempId ?? null,
    })),
  };

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("submit_native_waiver_atomic", {
    p_payload: payload,
  });

  if (error) {
    throw new WaiverSubmitError("database", "Unable to submit waiver");
  }

  const result = data as RpcOutcome;
  switch (result.outcome) {
    case "created":
      return {
        submissionId: String(result.submission_id),
        publicToken,
        expiresOn: String(result.expires_on ?? expiresOn),
        tokenExpiresAt: String(result.token_expires_at ?? tokenExpiresAt),
        reusedExisting: false,
        signatureStoragePath: result.signature_storage_path,
        documentStoragePath: result.document_storage_path,
      };
    case "reused":
      return {
        submissionId: String(result.submission_id),
        publicToken,
        expiresOn: String(result.expires_on ?? expiresOn),
        tokenExpiresAt: String(result.token_expires_at ?? tokenExpiresAt),
        reusedExisting: true,
      };
    case "idempotency_conflict":
      throw new WaiverSubmitError(
        "idempotency_conflict",
        "Idempotency key was reused with a different request",
      );
    case "incomplete_prior_state":
      throw new WaiverSubmitError(
        "incomplete_prior_state",
        "A prior submission for this key is incomplete",
      );
    case "template_version_not_found":
    case "template_inactive":
    case "template_version_not_current":
      throw new WaiverSubmitError("template_inactive", "Template is not available for signing");
    case "invalid_input":
    case "invalid_signature_content_type":
      throw new WaiverSubmitError("validation", "Invalid waiver submission");
    default:
      throw new WaiverSubmitError("database", "Unable to submit waiver");
  }
}

export type CompletionLookup = {
  submissionId: string;
  signedAt: string;
  expiresOn: string;
  expired: boolean;
  participantCount: number;
  status: string;
};

export async function getCompletionByToken(options: {
  token: string;
  evaluationAt?: Date;
}): Promise<CompletionLookup | null> {
  const token = options.token.trim();
  if (token.length < 32) return null;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_waiver_completion_by_token_hash", {
    p_token_hash: hashPublicToken(token),
  });
  if (error) {
    throw new WaiverSubmitError("database", "Unable to look up completion");
  }

  const result = data as {
    outcome: string;
    submission_id?: string;
    signed_at?: string;
    expires_on?: string;
    status?: string;
    participant_count?: number;
  };

  if (result.outcome === "token_expired") {
    throw new WaiverSubmitError("token_expired", "Completion token has expired");
  }
  if (result.outcome !== "ok" || !result.submission_id || !result.expires_on) {
    return null;
  }

  const evaluationAt = options.evaluationAt ?? new Date();
  const expired = isWaiverExpired({
    expiresOnYmd: result.expires_on,
    evaluationAt,
  });

  return {
    submissionId: result.submission_id,
    signedAt: String(result.signed_at),
    expiresOn: result.expires_on,
    expired,
    participantCount: Number(result.participant_count ?? 0),
    status: String(result.status ?? "completed"),
  };
}
