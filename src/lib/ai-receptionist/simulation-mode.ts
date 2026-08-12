import {
  getAiReceptionistConfig,
  type AiReceptionistConfig,
} from "./config";

/**
 * Owner demo / simulate APIs always force simulation mode, even if env was
 * misconfigured. Live actions require a separate Phase 2 wiring path.
 */
export function getForcedSimulationConfig(
  overrides?: Partial<AiReceptionistConfig>,
): AiReceptionistConfig {
  return getAiReceptionistConfig({
    ...overrides,
    liveActions: false,
  });
}

export const SIMULATION_BANNER =
  "SIMULATION — NO LIVE ACTIONS" as const;

export const PAYMENT_STUB_WARNING =
  "SIMULATED PAYMENT LINK — NOT A REAL CHARGE — NO CARD DATA COLLECTED" as const;
