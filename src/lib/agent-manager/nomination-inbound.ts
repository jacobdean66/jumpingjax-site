import type { GetReceivingEmailResponseSuccess } from "resend";

import type { NominationEmailEvent } from "@/lib/giveaway/nomination-email";

export type NominationInboundMetadata = {
  emailId: string;
  to: string[];
  subject: string;
};

function mailbox(value: string) {
  const bracketed = value.match(/<([^<>]+)>/)?.[1] ?? value;
  return bracketed.trim().toLowerCase();
}

export function isRelevantNominationInbound(
  metadata: NominationInboundMetadata,
  configuredRecipient: string | undefined,
) {
  const recipient = mailbox(configuredRecipient ?? "");
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) return false;
  if (!/nomination/i.test(metadata.subject)) return false;
  return metadata.to.some((address) => mailbox(address) === recipient);
}

export function toNominationEmailEvent(
  email: Pick<GetReceivingEmailResponseSuccess, "id" | "from" | "subject" | "text">,
): NominationEmailEvent {
  const id = email.id.trim();
  if (!/^[A-Za-z0-9._:-]{1,90}$/.test(id)) {
    throw new Error("Invalid inbound email ID");
  }

  return {
    sourceEventId: `resend:${id}`,
    from: email.from.slice(0, 320),
    subject: email.subject.slice(0, 300),
    text: email.text?.slice(0, 32_000) ?? "",
  };
}
