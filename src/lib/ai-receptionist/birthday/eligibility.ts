import { createHash } from "node:crypto";

import type { AiReceptionistConfig } from "../config";
import { getAiReceptionistConfig } from "../config";
import type {
  BirthdayCandidate,
  BirthdayDeliveryDecision,
  BirthdayExclusion,
  MarketingChannel,
  MarketingContactSnapshot,
  PriorBirthdayDelivery,
} from "../types";

const NY = "America/New_York";

export function ymdInTimeZone(date: Date, timeZone = NY): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Unable to format date in timezone");
  }
  return `${year}-${month}-${day}`;
}

export function parseYmd(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid YMD: ${ymd}`);
  return { y, m, d };
}

export function addDaysYmd(ymd: string, days: number): string {
  const { y, m, d } = parseYmd(ymd);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function daysBetweenYmd(fromYmd: string, toYmd: string): number {
  const a = parseYmd(fromYmd);
  const b = parseYmd(toYmd);
  const from = Date.UTC(a.y, a.m - 1, a.d);
  const to = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((to - from) / 86_400_000);
}

/** Next birthday on/after todayYmd (calendar date math, leap-day clamped). */
export function nextBirthdayOnOrAfter(dobYmd: string, todayYmd: string): string {
  const dob = parseYmd(dobYmd);
  const today = parseYmd(todayYmd);
  let year = today.y;
  const candidate = clampDobInYear(year, dob.m, dob.d);
  if (candidate < todayYmd) {
    year += 1;
    return clampDobInYear(year, dob.m, dob.d);
  }
  return candidate;
}

function clampDobInYear(year: number, month: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const d = Math.min(day, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function offerDateSixWeeksBefore(birthdayYmd: string): string {
  return addDaysYmd(birthdayYmd, -42);
}

export function childFingerprint(options: {
  firstName: string;
  lastName: string;
  dobYmd: string;
}): string {
  const material = [
    options.firstName.trim().toLowerCase(),
    options.lastName.trim().toLowerCase(),
    options.dobYmd.trim(),
  ].join("|");
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

export function buildOfferCode(options: {
  offerYear: number;
  childFingerprint: string;
  discountPercent: number;
}): string {
  const short = options.childFingerprint.slice(0, 8).toUpperCase();
  return `JJX-BDAY-${options.offerYear}-${options.discountPercent}-${short}`;
}

export function preferredChannel(
  contact: MarketingContactSnapshot,
): MarketingChannel | null {
  const smsOk =
    contact.smsMarketingOptIn &&
    !contact.smsOptedOutAt &&
    Boolean(contact.phoneE164);
  const emailOk =
    contact.emailMarketingOptIn &&
    !contact.emailOptedOutAt &&
    Boolean(contact.emailNormalized);
  if (smsOk) return "sms";
  if (emailOk) return "email";
  return null;
}

export function decideBirthdayDelivery(options: {
  todayYmd: string;
  candidate: BirthdayCandidate;
  contact: MarketingContactSnapshot | null;
  exclusions: BirthdayExclusion[];
  priorDeliveries: PriorBirthdayDelivery[];
  config?: Partial<AiReceptionistConfig>;
}): BirthdayDeliveryDecision {
  const config = getAiReceptionistConfig(options.config);
  const offerDate = options.candidate.offerDateYmd;
  if (offerDate !== options.todayYmd) {
    return { action: "suppress", reason: "wrong_offer_day" };
  }
  if (options.candidate.waiverExpiresOn < options.todayYmd) {
    return { action: "suppress", reason: "waiver_expired" };
  }
  if (!options.contact) {
    return { action: "suppress", reason: "no_contact" };
  }

  const excluded = options.exclusions.some((row) => {
    if (!row.active) return false;
    if (row.contactId && row.contactId === options.contact!.id) return true;
    if (
      row.childFingerprint &&
      row.childFingerprint === options.candidate.childFingerprint
    ) {
      return true;
    }
    return false;
  });
  if (excluded) {
    return { action: "suppress", reason: "excluded" };
  }

  const offerYear = parseYmd(options.candidate.nextBirthdayYmd).y;
  const prior = options.priorDeliveries.find(
    (row) =>
      row.contactId === options.contact!.id &&
      row.childFingerprint === options.candidate.childFingerprint &&
      row.offerYear === offerYear &&
      (row.status === "pending" ||
        row.status === "simulated" ||
        row.status === "sent"),
  );
  if (prior) {
    return { action: "suppress", reason: "annual_dedupe" };
  }

  if (options.contact.smsOptedOutAt && options.contact.emailOptedOutAt) {
    return { action: "suppress", reason: "opted_out" };
  }

  const channel = preferredChannel(options.contact);
  if (!channel) {
    if (!options.contact.smsMarketingOptIn && !options.contact.emailMarketingOptIn) {
      return { action: "suppress", reason: "no_opt_in" };
    }
    if (options.contact.smsOptedOutAt || options.contact.emailOptedOutAt) {
      return { action: "suppress", reason: "opted_out" };
    }
    return { action: "suppress", reason: "no_contact" };
  }

  const expiresOnYmd = addDaysYmd(options.todayYmd, config.offerExpiresDays);
  if (expiresOnYmd < options.todayYmd) {
    return { action: "suppress", reason: "offer_expired" };
  }

  // Phase 1: never send live. Even if liveActions later becomes true without a
  // provider, deliveries stay simulated until a live adapter is implemented.
  const status = config.liveActions ? "simulated" : "simulated";

  return {
    action: "deliver",
    channel,
    offerCode: buildOfferCode({
      offerYear,
      childFingerprint: options.candidate.childFingerprint,
      discountPercent: config.offerDiscountPercent,
    }),
    expiresOnYmd,
    offerYear,
    status,
  };
}

export function buildCandidateFromWaiverRow(row: {
  participantId: string;
  submissionId: string;
  childFirstName: string;
  childLastName: string;
  childDobYmd: string;
  signerEmail: string;
  signerPhone: string;
  signerFirstName: string;
  signerLastName: string;
  waiverExpiresOn: string;
  todayYmd: string;
  weeksBefore?: number;
}): BirthdayCandidate {
  const weeks = row.weeksBefore ?? 6;
  const nextBirthdayYmd = nextBirthdayOnOrAfter(row.childDobYmd, row.todayYmd);
  const offerDateYmd = addDaysYmd(nextBirthdayYmd, -(weeks * 7));
  return {
    participantId: row.participantId,
    submissionId: row.submissionId,
    childFirstName: row.childFirstName,
    childLastName: row.childLastName,
    childDobYmd: row.childDobYmd,
    nextBirthdayYmd,
    offerDateYmd,
    signerEmail: row.signerEmail,
    signerPhone: row.signerPhone,
    signerFirstName: row.signerFirstName,
    signerLastName: row.signerLastName,
    waiverExpiresOn: row.waiverExpiresOn,
    childFingerprint: childFingerprint({
      firstName: row.childFirstName,
      lastName: row.childLastName,
      dobYmd: row.childDobYmd,
    }),
  };
}
