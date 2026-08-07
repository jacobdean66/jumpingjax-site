/**
 * Serializable durable-protection status for Social Posts Admin UI.
 * Server computes this once and passes it to client components so the UI can
 * pre-disable billable actions before click. Server-side 503 remains authoritative.
 */

import { isDurableAgentStoreReady } from "./agent-durable-store";
import {
  getAgentProtectionMode,
  type AgentProtectionMode,
} from "./agent-protection-mode";

export const DURABLE_PROTECTION_UNAVAILABLE_UI_REASON =
  "Unavailable until durable shared protection is configured.";

export const COMPLIANCE_WAITING_FOR_PREVIEW_LABEL =
  "Compliance: waiting for model preview";

export type AgentUiProtectionStatus = {
  /** True when billable model-backed UI actions must be pre-disabled. */
  modelActionsDisabled: boolean;
  /** Concise visible reason when modelActionsDisabled is true; otherwise null. */
  reason: string | null;
  /** Honest compliance placeholder while no deterministic result exists. */
  complianceWaitingLabel: string;
  /** Raw protection mode for diagnostics / tests. */
  mode: AgentProtectionMode;
};

export async function getAgentUiProtectionStatus(
  env: NodeJS.ProcessEnv = process.env,
): Promise<AgentUiProtectionStatus> {
  const mode = getAgentProtectionMode(env);
  let modelActionsDisabled = mode.kind === "disabled";

  if (mode.kind === "durable-supabase") {
    modelActionsDisabled = !(await isDurableAgentStoreReady(env));
  }

  return {
    modelActionsDisabled,
    reason: modelActionsDisabled
      ? DURABLE_PROTECTION_UNAVAILABLE_UI_REASON
      : null,
    complianceWaitingLabel: COMPLIANCE_WAITING_FOR_PREVIEW_LABEL,
    mode,
  };
}
