import { createServiceRoleClient } from "@/lib/supabase/admin";
import { computeExpiresOnYmd, isWaiverExpired } from "./expiration";
import { createPublicCompletionToken, hashIpAddress } from "./tokens";
import {
  validateSubmissionDraft,
  type SubmissionDraft,
} from "./validation";

export type SubmitWaiverResult = {
  submissionId: string;
  publicToken: string;
  expiresOn: string;
  reusedExisting: boolean;
};

export class WaiverSubmitError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WaiverSubmitError";
    this.code = code;
  }
}

type TemplateVersionRow = {
  id: string;
  template_id: string;
  waiver_templates:
    | { id: string; status: string }
    | { id: string; status: string }[]
    | null;
};

function templateStatus(row: TemplateVersionRow): string | null {
  const templates = row.waiver_templates;
  if (!templates) return null;
  if (Array.isArray(templates)) return templates[0]?.status ?? null;
  return templates.status;
}

export async function submitWaiver(options: {
  draft: SubmissionDraft;
  requestIp?: string | null;
  userAgent?: string | null;
  now?: Date;
}): Promise<SubmitWaiverResult> {
  let draft: SubmissionDraft;
  try {
    draft = validateSubmissionDraft(options.draft);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid waiver submission";
    throw new WaiverSubmitError("validation", message);
  }

  const supabase = createServiceRoleClient();
  const now = options.now ?? new Date();
  const signedAt = now.toISOString();
  const expiresOn = computeExpiresOnYmd(now);

  if (draft.idempotencyKey) {
    const { data: existing, error: existingError } = await supabase
      .from("waiver_submissions")
      .select("id, public_token, expires_on")
      .eq("idempotency_key", draft.idempotencyKey)
      .maybeSingle();
    if (existingError) {
      throw new WaiverSubmitError("database", existingError.message);
    }
    if (existing) {
      return {
        submissionId: existing.id,
        publicToken: existing.public_token,
        expiresOn: existing.expires_on,
        reusedExisting: true,
      };
    }
  }

  const { data: version, error: versionError } = await supabase
    .from("waiver_template_versions")
    .select("id, template_id, waiver_templates(id, status)")
    .eq("id", draft.templateVersionId)
    .maybeSingle();

  if (versionError) {
    throw new WaiverSubmitError("database", versionError.message);
  }
  if (!version) {
    throw new WaiverSubmitError("template_inactive", "Template version not found");
  }
  if (templateStatus(version as TemplateVersionRow) !== "active") {
    throw new WaiverSubmitError("template_inactive", "Template is not active");
  }

  const publicToken = createPublicCompletionToken();
  const { data: submission, error: submissionError } = await supabase
    .from("waiver_submissions")
    .insert({
      public_token: publicToken,
      idempotency_key: draft.idempotencyKey,
      template_version_id: draft.templateVersionId,
      signer_first_name: draft.signer.firstName,
      signer_last_name: draft.signer.lastName,
      signer_email: draft.signer.email,
      signer_phone: draft.signer.phone,
      signed_at: signedAt,
      expires_on: expiresOn,
      source: draft.source,
      status: "completed",
    })
    .select("id, public_token, expires_on")
    .single();

  if (submissionError || !submission) {
    if (submissionError?.code === "23505" && draft.idempotencyKey) {
      const { data: raced } = await supabase
        .from("waiver_submissions")
        .select("id, public_token, expires_on")
        .eq("idempotency_key", draft.idempotencyKey)
        .maybeSingle();
      if (raced) {
        return {
          submissionId: raced.id,
          publicToken: raced.public_token,
          expiresOn: raced.expires_on,
          reusedExisting: true,
        };
      }
    }
    throw new WaiverSubmitError(
      "database",
      submissionError?.message || "Unable to create waiver submission",
    );
  }

  const adults = draft.participants.filter((p) => p.role !== "child");
  const children = draft.participants.filter((p) => p.role === "child");
  const tempToId = new Map<string, string>();

  for (const participant of adults) {
    const { data, error } = await supabase
      .from("waiver_participants")
      .insert({
        submission_id: submission.id,
        first_name: participant.firstName,
        last_name: participant.lastName,
        dob: participant.dob,
        role: participant.role,
        guardian_participant_id: null,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new WaiverSubmitError(
        "database",
        error?.message || "Unable to create waiver participant",
      );
    }
    tempToId.set(participant.tempId, data.id);
  }

  for (const participant of children) {
    const guardianId = tempToId.get(participant.guardianTempId || "");
    if (!guardianId) {
      throw new WaiverSubmitError(
        "validation",
        "Every child must have a guardian on the submission",
      );
    }
    const { data, error } = await supabase
      .from("waiver_participants")
      .insert({
        submission_id: submission.id,
        first_name: participant.firstName,
        last_name: participant.lastName,
        dob: participant.dob,
        role: "child",
        guardian_participant_id: guardianId,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw new WaiverSubmitError(
        "database",
        error?.message || "Unable to create child participant",
      );
    }
    tempToId.set(participant.tempId, data.id);
  }

  const { error: signatureError } = await supabase.from("waiver_signatures").insert({
    submission_id: submission.id,
    storage_path: draft.signatureStoragePath,
    content_type: draft.signatureContentType,
    ip_hash: hashIpAddress(options.requestIp),
    user_agent: options.userAgent?.slice(0, 512) ?? null,
    consent_payload: {
      acknowledgedRisk: draft.consent.acknowledgedRisk,
      acknowledgedTerms: draft.consent.acknowledgedTerms,
      isLegalGuardian: draft.consent.isLegalGuardian,
    },
    signed_at: signedAt,
  });
  if (signatureError) {
    throw new WaiverSubmitError("database", signatureError.message);
  }

  const { error: documentError } = await supabase.from("waiver_documents").insert({
    submission_id: submission.id,
    storage_path: `pending/${submission.id}.txt`,
    sha256: "0".repeat(64),
    generated_at: signedAt,
    source: "pending",
    status: "pending",
  });
  if (documentError) {
    throw new WaiverSubmitError("database", documentError.message);
  }

  await supabase.from("open_play_audit_events").insert({
    actor_staff_id: null,
    action: "waiver_submitted",
    entity_type: "waiver_submission",
    entity_id: submission.id,
    detail: {
      source: draft.source,
      participantCount: draft.participants.length,
      templateVersionId: draft.templateVersionId,
    },
  });

  return {
    submissionId: submission.id,
    publicToken: submission.public_token,
    expiresOn: submission.expires_on,
    reusedExisting: false,
  };
}

export type CompletionLookup = {
  submissionId: string;
  signerFirstName: string;
  signerLastName: string;
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
  const { data, error } = await supabase
    .from("waiver_submissions")
    .select(
      "id, signer_first_name, signer_last_name, signed_at, expires_on, status, waiver_participants(count)",
    )
    .eq("public_token", token)
    .maybeSingle();

  if (error) {
    throw new WaiverSubmitError("database", error.message);
  }
  if (!data) return null;

  const evaluationAt = options.evaluationAt ?? new Date();
  const expired = isWaiverExpired({
    expiresOnYmd: data.expires_on,
    evaluationAt,
  });

  const participantCountRaw = (data as { waiver_participants?: { count: number }[] })
    .waiver_participants;
  const participantCount = Array.isArray(participantCountRaw)
    ? Number(participantCountRaw[0]?.count ?? 0)
    : 0;

  return {
    submissionId: data.id,
    signerFirstName: data.signer_first_name,
    signerLastName: data.signer_last_name,
    signedAt: data.signed_at,
    expiresOn: data.expires_on,
    expired,
    participantCount,
    status: data.status,
  };
}
