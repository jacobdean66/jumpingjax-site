export type WaiverExportSubmission = {
  id: string;
  signer_first_name: string;
  signer_last_name: string;
  signer_email: string;
  signer_phone: string;
  signed_at: string;
  expires_on: string;
  source: string;
  status: string;
  smartwaiver_external_id: string | null;
  created_at: string;
};

export type WaiverExportParticipant = {
  id: string;
  submission_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  role: string;
  guardian_participant_id: string | null;
  created_at: string;
};

const HEADERS = [
  "submission_id",
  "participant_id",
  "participant_first_name",
  "participant_last_name",
  "participant_date_of_birth",
  "participant_role",
  "guardian_participant_id",
  "signer_first_name",
  "signer_last_name",
  "signer_email",
  "signer_phone",
  "signed_at",
  "expires_on",
  "status",
  "source",
  "smartwaiver_external_id",
  "submission_created_at",
  "participant_created_at",
] as const;

function spreadsheetSafeValue(value: unknown): string {
  const text = value == null ? "" : String(value);
  // Excel and similar tools can execute cells beginning with these characters.
  // Prefixing an apostrophe preserves the visible value while forcing plain text.
  return /^[\u0009\u000d =+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value: unknown): string {
  return `"${spreadsheetSafeValue(value).replaceAll('"', '""')}"`;
}

export function buildWaiverExportCsv(options: {
  submissions: WaiverExportSubmission[];
  participants: WaiverExportParticipant[];
}): string {
  const participantsBySubmission = new Map<string, WaiverExportParticipant[]>();
  for (const participant of options.participants) {
    const existing = participantsBySubmission.get(participant.submission_id) ?? [];
    existing.push(participant);
    participantsBySubmission.set(participant.submission_id, existing);
  }

  const rows: unknown[][] = [Array.from(HEADERS)];
  for (const submission of options.submissions) {
    const participants = participantsBySubmission.get(submission.id) ?? [null];
    for (const participant of participants) {
      rows.push([
        submission.id,
        participant?.id,
        participant?.first_name,
        participant?.last_name,
        participant?.dob,
        participant?.role,
        participant?.guardian_participant_id,
        submission.signer_first_name,
        submission.signer_last_name,
        submission.signer_email,
        submission.signer_phone,
        submission.signed_at,
        submission.expires_on,
        submission.status,
        submission.source,
        submission.smartwaiver_external_id,
        submission.created_at,
        participant?.created_at,
      ]);
    }
  }

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

