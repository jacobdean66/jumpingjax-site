import type { EmailAdapter } from "../adapters/email";
import type { SmsAdapter } from "../adapters/sms";
import type { AuditLog } from "../audit";
import type { AiReceptionistConfig } from "../config";
import { getAiReceptionistConfig } from "../config";
import type {
  BirthdayCandidate,
  BirthdayExclusion,
  MarketingContactSnapshot,
  PriorBirthdayDelivery,
} from "../types";
import {
  decideBirthdayDelivery,
  ymdInTimeZone,
} from "./eligibility";

export type BirthdayRunInput = {
  todayYmd?: string;
  candidates: BirthdayCandidate[];
  contactsById: Map<string, MarketingContactSnapshot>;
  /** Map signer email/phone normalized key → contact id */
  contactIdBySignerKey: Map<string, string>;
  exclusions: BirthdayExclusion[];
  priorDeliveries: PriorBirthdayDelivery[];
};

export type BirthdayLedgerEntry = {
  participantId: string;
  childFingerprint: string;
  offerYear: number | null;
  status: "simulated" | "suppressed";
  channel: "sms" | "email" | null;
  reason: string | null;
  offerCode: string | null;
  expiresOnYmd: string | null;
  messageId?: string;
};

export type BirthdayRunResultItem = {
  participantId: string;
  childFingerprint: string;
  decision: ReturnType<typeof decideBirthdayDelivery>;
  messageId?: string;
  ledger: BirthdayLedgerEntry;
};

export type BirthdaySchedulerDeps = {
  config?: AiReceptionistConfig;
  audit: AuditLog;
  sms: SmsAdapter;
  email: EmailAdapter;
};

export async function runBirthdayOfferDryRun(
  deps: BirthdaySchedulerDeps,
  input: BirthdayRunInput,
): Promise<{
  todayYmd: string;
  results: BirthdayRunResultItem[];
  ledger: BirthdayLedgerEntry[];
}> {
  const config = deps.config ?? getAiReceptionistConfig();
  const todayYmd = input.todayYmd ?? ymdInTimeZone(new Date());
  const results: BirthdayRunResultItem[] = [];
  const ledger: BirthdayLedgerEntry[] = [];

  for (const candidate of input.candidates) {
    const contactId =
      input.contactIdBySignerKey.get(candidate.signerEmail.trim().toLowerCase()) ??
      input.contactIdBySignerKey.get(candidate.signerPhone.trim()) ??
      null;
    const contact = contactId ? input.contactsById.get(contactId) ?? null : null;
    const decision = decideBirthdayDelivery({
      todayYmd,
      candidate,
      contact,
      exclusions: input.exclusions,
      priorDeliveries: input.priorDeliveries,
      config,
    });

    let messageId: string | undefined;
    let ledgerEntry: BirthdayLedgerEntry;

    if (decision.action === "deliver" && contact) {
      const body = [
        `Jumping Jax birthday rental offer (${decision.offerCode}):`,
        `${config.offerDiscountPercent}% off a rental for a child's upcoming birthday.`,
        `Offer expires ${decision.expiresOnYmd}.`,
        `Reply STOP to opt out of SMS if this arrived by text.`,
      ].join(" ");

      if (decision.channel === "sms" && contact.phoneE164) {
        const sent = await deps.sms.send({
          toE164: contact.phoneE164,
          body,
          purpose: "birthday_offer",
        });
        messageId = sent.messageId;
        deps.audit.append(null, "sms_simulated", {
          purpose: "birthday_offer",
          status: sent.status,
          participantId: candidate.participantId,
          childFingerprint: candidate.childFingerprint,
        });
      } else if (decision.channel === "email" && contact.emailNormalized) {
        const sent = await deps.email.send({
          toEmail: contact.emailNormalized,
          subject: "Jumping Jax birthday rental offer (SIMULATED)",
          body,
          purpose: "birthday_offer",
        });
        messageId = sent.messageId;
        deps.audit.append(null, "email_simulated", {
          purpose: "birthday_offer",
          status: sent.status,
          participantId: candidate.participantId,
          childFingerprint: candidate.childFingerprint,
        });
      }

      ledgerEntry = {
        participantId: candidate.participantId,
        childFingerprint: candidate.childFingerprint,
        offerYear: decision.offerYear,
        status: "simulated",
        channel: decision.channel,
        reason: null,
        offerCode: decision.offerCode,
        expiresOnYmd: decision.expiresOnYmd,
        messageId,
      };
    } else {
      const reason =
        decision.action === "suppress" ? decision.reason : "no_opt_in";
      ledgerEntry = {
        participantId: candidate.participantId,
        childFingerprint: candidate.childFingerprint,
        offerYear: null,
        status: "suppressed",
        channel: null,
        reason,
        offerCode: null,
        expiresOnYmd: null,
      };
      deps.audit.append(null, "tool_result", {
        tool: "birthday_offer",
        status: "suppressed",
        reason,
        participantId: candidate.participantId,
        childFingerprint: candidate.childFingerprint,
      });
    }

    ledger.push(ledgerEntry);
    results.push({
      participantId: candidate.participantId,
      childFingerprint: candidate.childFingerprint,
      decision,
      messageId,
      ledger: ledgerEntry,
    });
  }

  return { todayYmd, results, ledger };
}
