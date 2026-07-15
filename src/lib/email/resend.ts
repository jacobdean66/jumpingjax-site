const DEFAULT_OWNER_EMAIL = "jacobdean1166@gmail.com";

function splitEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,\s;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function uniqueEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  return emails.filter((email) => {
    const key = email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getFacilityOwnerEmails(): string[] {
  const configured = splitEmails(process.env.FACILITY_OWNER_EMAIL);
  const recipients = configured.length > 0 ? configured : [DEFAULT_OWNER_EMAIL];
  return uniqueEmails(recipients);
}

export function getFacilityOwnerEmail(): string {
  return getFacilityOwnerEmails()[0] ?? DEFAULT_OWNER_EMAIL;
}

export function getResendFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Jumping Jax <onboarding@resend.dev>"
  );
}
