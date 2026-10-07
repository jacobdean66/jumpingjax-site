import { createServiceRoleClient } from "../supabase/admin";
import {
  ELECTRONIC_SIGNATURE_NOTICE,
  AGREEMENT_STATEMENTS,
  type TypedAgreement,
} from "./typed-agreements";

type SavedParticipant = {
  temp_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  role: string;
  guardian_temp_id: string | null;
  adult_mode: string | null;
};
type SavedGroup = {
  legal_body_html: string;
  legal_body_sha256: string;
  record_payload: {
    participants: SavedParticipant[];
    agreements: TypedAgreement[];
    signedAt: string;
    expiresOn: string;
    templateVersionId: string;
    agreementText?: {
      signatureNotice: string;
      statements: typeof AGREEMENT_STATEMENTS;
    };
  };
};
export async function getSignedGroupRecord(
  submissionId: string,
): Promise<SavedGroup | null> {
  const { data, error } = await createServiceRoleClient()
    .from("waiver_group_records")
    .select("legal_body_html,legal_body_sha256,record_payload")
    .eq("submission_id", submissionId)
    .maybeSingle();
  if (error) throw new Error("Unable to load signed waiver");
  return data as SavedGroup | null;
}
function escape(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
export function renderSignedGroupRecord(record: SavedGroup): string {
  const p = record.record_payload;
  const signatureNotice =
    p.agreementText?.signatureNotice ?? ELECTRONIC_SIGNATURE_NOTICE;
  const statements = p.agreementText?.statements ?? AGREEMENT_STATEMENTS;
  const names = p.participants
    .map(
      (member) =>
        `<li>${escape(member.first_name)} ${escape(member.last_name)} — ${escape(member.role === "child" ? "Child" : member.adult_mode === "playing" ? "Playing adult" : "Watching adult")} · Date of birth: ${escape(member.dob)}</li>`,
    )
    .join("");
  const signatures = p.agreements
    .map((a) => {
      const wards = p.participants.filter(
        (c) => c.role === "child" && c.guardian_temp_id === a.participantTempId,
      );
      const confirmations = Object.entries(statements)
        .filter(([key]) => key !== "guardianAuthority" || wards.length > 0)
        .map(
          ([key, text]) =>
            `<li>${escape(text)} — ${a[key as keyof TypedAgreement] === true ? "Confirmed" : "Not selected"}</li>`,
        )
        .join("");
      return `<section class="signature"><h2>${escape(a.firstName)} ${escape(a.lastName)}</h2><p><strong>Typed electronic signature:</strong> ${escape(a.firstName)} ${escape(a.lastName)}</p><p>${escape(signatureNotice)}</p><ul>${confirmations}</ul>${wards.length ? `<p>Confirmed parent/legal guardian for: ${wards.map((c) => escape(c.first_name) + " " + escape(c.last_name)).join(", ")}. Guardian authority: ${a.guardianAuthority ? "Confirmed" : "Missing"}.</p>` : ""}<p>Recorded at: ${escape(p.signedAt)}</p></section>`;
    })
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jumping Jax — completed waiver</title><style>body{font:16px/1.6 Arial,sans-serif;color:#172033;max-width:850px;margin:40px auto;padding:0 24px}h1{font-size:28px}h2{font-size:22px}section.signature{border:1px solid #bbb;padding:20px;margin:20px 0;break-inside:avoid}footer{font-size:12px;overflow-wrap:anywhere}.print-note{background:#e8f6ff;padding:16px}@media print{body{margin:0}.print-note{display:none}}</style></head><body><p class="print-note">Completed waiver copy. Use your browser’s Print option to print this document or save it as a PDF.</p>${record.legal_body_html}<h2>Covered group</h2><ul>${names}</ul><h2>Recorded adult agreements</h2>${signatures}<footer><p>Signed: ${escape(p.signedAt)} · Expiration date: ${escape(p.expiresOn)}. An adult agreement is required when a child turns 18.</p><p>Waiver version: ${escape(p.templateVersionId)}<br>Legal-text SHA-256: ${escape(record.legal_body_sha256)}</p></footer></body></html>`;
}
export function signedRecordResponse(
  record: SavedGroup,
  download: boolean,
): Response {
  return new Response(renderSignedGroupRecord(record), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="jumping-jax-signed-waiver.html"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
    },
  });
}
