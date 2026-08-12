import { randomUUID } from "node:crypto";

import type { AiReceptionistConfig } from "../config";
import { assertLiveActionsAllowed } from "../config";

export type PhoneInboundEvent = {
  callSid: string;
  fromE164: string | null;
  toE164: string | null;
  text?: string;
};

export interface PhoneAdapter {
  readonly provider: string;
  acceptInbound(event: PhoneInboundEvent): Promise<{
    sessionHintId: string;
    accepted: true;
    simulated: boolean;
  }>;
}

export class SimPhoneAdapter implements PhoneAdapter {
  readonly provider = "sim-phone";
  private readonly events: PhoneInboundEvent[] = [];

  constructor(private readonly config: AiReceptionistConfig) {}

  async acceptInbound(event: PhoneInboundEvent) {
    if (this.config.liveActions) {
      // Even if live flag is on, this adapter remains simulated until a real provider is wired.
    }
    this.events.push(event);
    return {
      sessionHintId: randomUUID(),
      accepted: true as const,
      simulated: true,
    };
  }

  listEvents(): PhoneInboundEvent[] {
    return [...this.events];
  }
}

/** Placeholder for future Vapi/Retell/Twilio phone adapters. */
export class LivePhoneAdapterNotImplemented implements PhoneAdapter {
  readonly provider = "live-phone-unimplemented";

  constructor(private readonly config: AiReceptionistConfig) {}

  async acceptInbound(event: PhoneInboundEvent): Promise<never> {
    void event;
    assertLiveActionsAllowed(this.config, "phone.acceptInbound");
    throw new Error("live_phone_adapter_not_implemented");
  }
}
