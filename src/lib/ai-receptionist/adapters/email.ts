import { randomUUID } from "node:crypto";

import type { AiReceptionistConfig } from "../config";
import { assertLiveActionsAllowed } from "../config";

export type OutboundEmail = {
  toEmail: string;
  subject: string;
  body: string;
  purpose: "payment_link" | "birthday_offer" | "callback" | "other";
};

export type EmailSendResult = {
  messageId: string;
  status: "simulated" | "sent";
  simulated: boolean;
};

export interface EmailAdapter {
  readonly provider: string;
  send(message: OutboundEmail): Promise<EmailSendResult>;
}

export class SimEmailAdapter implements EmailAdapter {
  readonly provider = "sim-email";
  private readonly sent: Array<OutboundEmail & EmailSendResult> = [];

  constructor(private readonly config: AiReceptionistConfig) {}

  async send(message: OutboundEmail): Promise<EmailSendResult> {
    if (this.config.liveActions) {
      assertLiveActionsAllowed(this.config, "email.send_live");
      throw new Error("live_email_adapter_not_implemented");
    }
    const result: EmailSendResult = {
      messageId: randomUUID(),
      status: "simulated",
      simulated: true,
    };
    this.sent.push({ ...message, ...result });
    return result;
  }

  listSent(): Array<OutboundEmail & EmailSendResult> {
    return [...this.sent];
  }
}
