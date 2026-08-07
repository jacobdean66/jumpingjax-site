/**
 * Maps stable public waiver API error codes to visitor-safe messages.
 * Does not expose SQL, storage paths, stack traces, or internal IDs.
 */

export type PublicWaiverErrorCode =
  | "invalid_json"
  | "invalid_body"
  | "payload_too_large"
  | "validation"
  | "template_inactive"
  | "idempotency_conflict"
  | "incomplete_prior_state"
  | "misconfigured"
  | "token_expired"
  | "not_found"
  | "database"
  | "rate_limited"
  | "network"
  | "unknown"
  | "missing_template"
  | "ambiguous_active_template"
  | "incomplete_template"
  | "empty_signature"
  | "client_validation";

const MESSAGES: Record<PublicWaiverErrorCode, string> = {
  invalid_json: "The waiver form could not be sent. Please try again.",
  invalid_body: "The waiver form could not be read. Please try again.",
  payload_too_large: "The waiver submission is too large. Remove participants or clear the signature and try again.",
  validation: "Please check the highlighted fields and try again.",
  template_inactive:
    "This waiver form is not available right now. Please ask staff for help or try again later.",
  idempotency_conflict:
    "This waiver was already submitted with different information. Start a new waiver to continue.",
  incomplete_prior_state:
    "A previous attempt did not finish. Start a new waiver to continue.",
  misconfigured:
    "Online waivers are temporarily unavailable. Please ask staff for help.",
  token_expired: "This completion link has expired. You can start a new waiver if needed.",
  not_found: "We could not find that waiver confirmation.",
  database: "Something went wrong on our side. Please try again in a moment.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  network: "Connection problem. Check your signal and try again.",
  unknown: "Something went wrong. Please try again.",
  missing_template:
    "The waiver legal text is not available from the server, so this form cannot be completed online.",
  ambiguous_active_template:
    "The active waiver is not uniquely defined right now. Please ask staff for help.",
  incomplete_template:
    "The active waiver could not be loaded completely. Please ask staff for help or try again later.",
  empty_signature: "Please draw your signature before continuing.",
  client_validation: "Please fix the items below before continuing.",
};

/** Validation message snippets that map to clearer field-oriented copy. */
export function mapValidationDetail(serverMessage: string | undefined): string {
  const raw = (serverMessage ?? "").trim();
  if (!raw) return MESSAGES.validation;

  const lower = raw.toLowerCase();
  if (lower.includes("consent")) {
    return "Please check each required consent box.";
  }
  if (lower.includes("legal guardian")) {
    return "Please confirm you have authority to sign for the minors listed.";
  }
  if (lower.includes("guardian")) {
    return "Every child needs a parent or legal guardian listed on this waiver.";
  }
  if (lower.includes("date of birth") || lower.includes("dob")) {
    return "Please enter a valid date of birth for each participant.";
  }
  if (lower.includes("email")) {
    return "Please enter a valid email address for the signer.";
  }
  if (lower.includes("signer") && lower.includes("match")) {
    return "Signer name must match the adult signer participant.";
  }
  if (lower.includes("templateversionid") || lower.includes("template")) {
    return MESSAGES.template_inactive;
  }
  if (lower.includes("signature")) {
    return "Signature information is missing or not accepted.";
  }
  if (lower.includes("participant")) {
    return raw.length <= 160 ? raw : MESSAGES.validation;
  }
  // Backend validation messages are already visitor-oriented; keep when short.
  if (raw.length <= 160 && !/[A-Z]{3,}_|[.]ts\b|supabase|sql|stack/i.test(raw)) {
    return raw;
  }
  return MESSAGES.validation;
}

export function messageForPublicWaiverError(
  code: string | undefined,
  options?: { serverMessage?: string; status?: number },
): string {
  if (options?.status === 429 || code === "rate_limited") {
    return MESSAGES.rate_limited;
  }
  if (code === "validation") {
    return mapValidationDetail(options?.serverMessage);
  }
  if (code && code in MESSAGES) {
    return MESSAGES[code as PublicWaiverErrorCode];
  }
  return MESSAGES.unknown;
}

export function parsePublicWaiverErrorResponse(payload: unknown, status: number): {
  code: PublicWaiverErrorCode | string;
  message: string;
} {
  if (status === 429) {
    return { code: "rate_limited", message: MESSAGES.rate_limited };
  }

  const body = (payload ?? {}) as {
    ok?: boolean;
    code?: string;
    error?: string;
  };
  const code = typeof body.code === "string" && body.code ? body.code : "unknown";
  return {
    code,
    message: messageForPublicWaiverError(code, {
      serverMessage: typeof body.error === "string" ? body.error : undefined,
      status,
    }),
  };
}
