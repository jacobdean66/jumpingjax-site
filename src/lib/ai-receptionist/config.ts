/**
 * AI receptionist Phase 1 configuration.
 * Live actions stay disabled unless explicitly unlocked after owner approval.
 */

export const AI_RECEPTIONIST_DISCLOSURE_VERSION = "v1-2026-08-11" as const;

export type AiReceptionistConfig = {
  liveActions: boolean;
  disclosureVersion: typeof AI_RECEPTIONIST_DISCLOSURE_VERSION;
  transferTargetSim: string;
  confidenceThreshold: number;
  maxBookingAttempts: number;
  paymentStubBaseUrl: string;
  birthdayWeeksBefore: number;
  offerDiscountPercent: number;
  offerExpiresDays: number;
};

function envFlagTrue(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function getAiReceptionistConfig(
  overrides?: Partial<AiReceptionistConfig>,
): AiReceptionistConfig {
  const base: AiReceptionistConfig = {
    // Hard default: false. Live telephony/SMS/email/payments require owner approval.
    liveActions: envFlagTrue("AI_RECEPTIONIST_LIVE_ACTIONS"),
    disclosureVersion: AI_RECEPTIONIST_DISCLOSURE_VERSION,
    transferTargetSim:
      process.env.AI_RECEPTIONIST_TRANSFER_TARGET_SIM?.trim() ||
      "sim:+18649331420",
    confidenceThreshold: 0.55,
    maxBookingAttempts: 3,
    paymentStubBaseUrl:
      process.env.AI_RECEPTIONIST_PAYMENT_STUB_BASE_URL?.trim() ||
      "https://pay.simulated.jumpingjax.local/deposit",
    birthdayWeeksBefore: 6,
    offerDiscountPercent: 20,
    offerExpiresDays: 14,
  };
  return { ...base, ...overrides };
}

export function assertLiveActionsAllowed(
  config: AiReceptionistConfig,
  action: string,
): void {
  if (!config.liveActions) {
    throw new Error(
      `ai_receptionist_live_actions_disabled: refused ${action}. Owner approval required.`,
    );
  }
}
