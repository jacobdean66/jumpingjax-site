import { formatPublicChildDisplayName } from "./public-nominee-display";

export type GiveawayPartyChoice = "september_birthday" | "back_to_school";

export type NominationEmailEvent = {
  sourceEventId: string;
  from: string;
  subject: string;
  text: string;
};

export type GiveawayNominationRow = {
  idempotency_key: string;
  nominator_name: string;
  nominator_email: string;
  child_name: string;
  child_birth_month: number;
  child_birth_day: number;
  party_choice: GiveawayPartyChoice;
  nomination_reason: string;
  permission_acknowledged: true;
};

const PARTY_CHOICES: Record<string, GiveawayPartyChoice> = {
  "September birthday party": "september_birthday",
  "Back-to-school party": "back_to_school",
};

function field(text: string, label: string) {
  return text.match(new RegExp(`^${label}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
}

function validMonthDay(month: number, day: number) {
  return Number.isInteger(month) && Number.isInteger(day) && month >= 1 && month <= 12 && day >= 1 && day <= new Date(2024, month, 0).getDate();
}

export function parseNominationEmail(event: NominationEmailEvent): GiveawayNominationRow {
  const sourceEventId = event.sourceEventId.trim();
  if (!/^[A-Za-z0-9._:-]{1,100}$/.test(sourceEventId)) throw new Error("Invalid nomination source event ID");
  if (!/nomination/i.test(event.subject)) throw new Error("Email is not a nomination event");

  const nominatorName = field(event.text, "Nominator").slice(0, 120);
  const nominatorEmail = field(event.text, "Nominator email").toLowerCase().slice(0, 254);
  const childName = formatPublicChildDisplayName(field(event.text, "Child").slice(0, 80));
  const birthday = field(event.text, "Birthday").match(/^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/);
  const partyChoice = PARTY_CHOICES[field(event.text, "Party choice")];
  const reason = event.text.match(/Why this child was nominated:\s*\r?\n([\s\S]*?)(?:\r?\n(?:Submitted|Nomination ID):|$)/i)?.[1]?.trim().slice(0, 1500) ?? "";
  const month = Number(birthday?.[1]);
  const day = Number(birthday?.[2]);

  if (!nominatorName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nominatorEmail) || childName === "Nominee" || !validMonthDay(month, day) || !partyChoice || reason.length < 10) {
    throw new Error("Nomination email is missing required structured fields");
  }

  return {
    idempotency_key: `email:${sourceEventId}`,
    nominator_name: nominatorName,
    nominator_email: nominatorEmail,
    child_name: childName,
    child_birth_month: month,
    child_birth_day: day,
    party_choice: partyChoice,
    nomination_reason: reason,
    permission_acknowledged: true,
  };
}

