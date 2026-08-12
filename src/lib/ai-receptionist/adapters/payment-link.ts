import { randomUUID } from "node:crypto";

import type { AiReceptionistConfig } from "../config";
import { assertLiveActionsAllowed } from "../config";
import { PAYMENT_STUB_WARNING } from "../simulation-mode";
import type { PaymentLinkResult } from "../types";

export type CreatePaymentLinkInput = {
  sessionId: string;
  bookingId?: string | null;
  amountCents?: number | null;
  expiresInHours?: number;
};

export interface PaymentLinkAdapter {
  readonly provider: string;
  createDepositLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResult>;
}

export class SimPaymentLinkAdapter implements PaymentLinkAdapter {
  readonly provider = "sim-payment-link";
  private readonly links: PaymentLinkResult[] = [];

  constructor(private readonly config: AiReceptionistConfig) {}

  async createDepositLink(
    input: CreatePaymentLinkInput,
  ): Promise<PaymentLinkResult> {
    if (this.config.liveActions) {
      assertLiveActionsAllowed(this.config, "payment.create_live");
      throw new Error("live_payment_adapter_not_implemented");
    }
    const token = randomUUID().replace(/-/g, "").slice(0, 24);
    const expiresAt = new Date(
      Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000,
    );
    const result: PaymentLinkResult = {
      ok: true,
      token,
      simulatedUrl: `${this.config.paymentStubBaseUrl}/${token}`,
      expiresAtIso: expiresAt.toISOString(),
      charged: false,
      simulated: true,
      warningLabel: PAYMENT_STUB_WARNING,
    };
    this.links.push(result);
    return result;
  }

  listLinks(): PaymentLinkResult[] {
    return [...this.links];
  }
}
