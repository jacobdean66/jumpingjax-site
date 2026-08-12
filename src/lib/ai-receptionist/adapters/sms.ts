import { randomUUID } from "node:crypto";

import type { AiReceptionistConfig } from "../config";
import { assertLiveActionsAllowed } from "../config";

export type OutboundSms = {
  toE164: string;
  body: string;
  purpose: "payment_link" | "birthday_offer" | "callback" | "other";
};

export type SmsSendResult = {
  messageId: string;
  status: "simulated" | "sent";
  simulated: boolean;
};

export interface SmsAdapter {
  readonly provider: string;
  send(message: OutboundSms): Promise<SmsSendResult>;
}

export class SimSmsAdapter implements SmsAdapter {
  readonly provider = "sim-sms";
  private readonly sent: Array<OutboundSms & SmsSendResult> = [];

  constructor(private readonly config: AiReceptionistConfig) {}

  async send(message: OutboundSms): Promise<SmsSendResult> {
    if (this.config.liveActions) {
      assertLiveActionsAllowed(this.config, "sms.send_live");
      // Live path not implemented in Phase 1.
      throw new Error("live_sms_adapter_not_implemented");
    }
    const result: SmsSendResult = {
      messageId: randomUUID(),
      status: "simulated",
      simulated: true,
    };
    this.sent.push({ ...message, ...result });
    return result;
  }

  listSent(): Array<OutboundSms & SmsSendResult> {
    return [...this.sent];
  }
}
