import { FACILITY_INVITATION_VENUE } from "./snapshot";

export type InvitationCopyInput = {
  childName?: string | null;
  childAge?: string | null;
  customerPhone?: string | null;
  dateLabel?: string | null;
  timeLabel?: string | null;
  themeText?: string | null;
  invitationUrl?: string | null;
  printableUrl?: string | null;
  waiverUrl?: string | null;
};

export type InvitationCopy = {
  childName: string;
  ageLabel: string;
  headline: string;
  dateLabel: string;
  timeLabel: string;
  venueLine: string;
  customerPhone: string;
};

function clean(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const THEME_PLACEHOLDER = /^(?:will\s+call|tbd|to\s+be\s+determined|none|n\/?a|not\s+sure|unsure)$/i;

function meaningfulThemeText(value: string | null | undefined): string {
  const normalized = clean(value);
  return THEME_PLACEHOLDER.test(normalized) ? "" : normalized;
}

export function invitationThemeDisplayText(
  value: string | null | undefined,
): string {
  return meaningfulThemeText(value) || "Classic birthday";
}

function ordinalAge(value: string): string {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 120) return value;
  const mod100 = numeric % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${numeric}th`;
  if (numeric % 10 === 1) return `${numeric}st`;
  if (numeric % 10 === 2) return `${numeric}nd`;
  if (numeric % 10 === 3) return `${numeric}rd`;
  return `${numeric}th`;
}

export function buildInvitationCopy(input: InvitationCopyInput): InvitationCopy {
  const childName = clean(input.childName) || "Birthday Star";
  const childAge = clean(input.childAge);
  const ageLabel = childAge ? ordinalAge(childAge) : "";
  return {
    childName,
    ageLabel,
    headline: childAge
      ? `${childName} is turning ${childAge}!`
      : `Celebrate with ${childName}!`,
    dateLabel: clean(input.dateLabel) || "Date coming soon",
    timeLabel: clean(input.timeLabel) || "Time coming soon",
    venueLine: `${FACILITY_INVITATION_VENUE.name} - ${FACILITY_INVITATION_VENUE.address} - ${FACILITY_INVITATION_VENUE.phone}`,
    customerPhone: clean(input.customerPhone),
  };
}

export function buildInvitationEmailDraft(input: InvitationCopyInput): {
  subject: string;
  body: string;
} {
  const copy = buildInvitationCopy(input);
  const birthday = copy.ageLabel
    ? `${copy.childName}'s ${copy.ageLabel} birthday`
    : `${copy.childName}'s birthday`;
  const lines = [
    `You're invited to celebrate ${birthday} at Jumping Jax!`,
    "",
    `Date: ${copy.dateLabel}`,
    `Time: ${copy.timeLabel}`,
    `Location: ${copy.venueLine}`,
    copy.customerPhone ? `Party contact: ${copy.customerPhone}` : null,
    "",
    input.invitationUrl ? `View the invitation: ${clean(input.invitationUrl)}` : null,
    input.printableUrl ? `Download or print invitations: ${clean(input.printableUrl)}` : null,
    input.waiverUrl ? `RSVP and complete the waiver: ${clean(input.waiverUrl)}` : null,
    "",
    "We can't wait to celebrate with you!",
    "Jumping Jax",
  ].filter((line): line is string => line !== null);

  return {
    subject: `You're invited: ${birthday} at Jumping Jax`,
    body: lines.join("\n"),
  };
}

export function buildCustomerInvitationEmailSection(
  input: InvitationCopyInput,
): string[] {
  const copy = buildInvitationCopy(input);
  return [
    "Your invitation package",
    `Guest of honor: ${copy.childName}${copy.ageLabel ? ` (${copy.ageLabel} birthday)` : ""}`,
    `Theme: ${invitationThemeDisplayText(input.themeText)}`,
    `Date: ${copy.dateLabel}`,
    `Time: ${copy.timeLabel}`,
    `Location: ${copy.venueLine}`,
    copy.customerPhone ? `Party contact: ${copy.customerPhone}` : "",
    input.invitationUrl ? `View and share invitation: ${clean(input.invitationUrl)}` : "",
    input.printableUrl ? `Printable invitations: ${clean(input.printableUrl)}` : "",
    input.waiverUrl ? `Guest RSVP and waiver: ${clean(input.waiverUrl)}` : "",
  ].filter(Boolean);
}
