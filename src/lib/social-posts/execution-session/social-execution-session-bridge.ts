import { isSupabaseServiceConfigured } from "../../supabase/admin";
import type { SocialExecutionSessionPersistenceSnapshot } from "./social-execution-session-store";
import {
  EMPTY_SOCIAL_EXECUTION_SESSION_PERSISTENCE_SNAPSHOT,
  isSocialExecutionSessionStoreConfigured,
  loadSocialExecutionSessionSnapshot,
} from "./social-execution-session-store";

export const SOCIAL_EXECUTION_SESSION_BRIDGE_MODES = ["production", "reference"] as const;

export type SocialExecutionSessionBridgeMode =
  (typeof SOCIAL_EXECUTION_SESSION_BRIDGE_MODES)[number];

export const SOCIAL_EXECUTION_SESSION_BRIDGE_ERROR_CODES = [
  "storage_unavailable",
  "storage_misconfigured",
  "load_failed",
] as const;

export type SocialExecutionSessionBridgeErrorCode =
  (typeof SOCIAL_EXECUTION_SESSION_BRIDGE_ERROR_CODES)[number];

export type SocialExecutionSessionBridgeError = Readonly<{
  code: SocialExecutionSessionBridgeErrorCode;
  message: string;
}>;

export type SocialExecutionSessionBridgeLoadResult = Readonly<{
  mode: SocialExecutionSessionBridgeMode;
  storageConfigured: boolean;
  durableHistoryAvailable: boolean;
  snapshot: SocialExecutionSessionPersistenceSnapshot;
  computedOnly: true;
  readOnly: true;
  authoritative: false;
  grantsExecutionPermission: false;
  executesNothing: true;
  publishesNothing: true;
}>;

export type SocialExecutionSessionBridgeResult<T> = Readonly<
  | { ok: true; value: T }
  | { ok: false; error: SocialExecutionSessionBridgeError }
>;

export async function loadSocialExecutionSessionBridgeSnapshot(input?: {
  snapshot?: SocialExecutionSessionPersistenceSnapshot;
  storageConfigured?: boolean;
}): Promise<SocialExecutionSessionBridgeResult<SocialExecutionSessionBridgeLoadResult>> {
  const storageConfigured = input?.storageConfigured ?? isSocialExecutionSessionStoreConfigured();

  if (!storageConfigured) {
    return {
      ok: true,
      value: {
        mode: "reference",
        storageConfigured: false,
        durableHistoryAvailable: false,
        snapshot: EMPTY_SOCIAL_EXECUTION_SESSION_PERSISTENCE_SNAPSHOT,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    };
  }

  try {
    const snapshot = input?.snapshot ?? (await loadSocialExecutionSessionSnapshot());
    const mode: SocialExecutionSessionBridgeMode = isSupabaseServiceConfigured()
      ? "production"
      : "reference";

    return {
      ok: true,
      value: {
        mode,
        storageConfigured: true,
        durableHistoryAvailable: snapshot.sessions.length > 0 || snapshot.auditEvents.length > 0,
        snapshot,
        computedOnly: true,
        readOnly: true,
        authoritative: false,
        grantsExecutionPermission: false,
        executesNothing: true,
        publishesNothing: true,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "load_failed",
        message: error instanceof Error ? error.message : "Execution session snapshot load failed.",
      },
    };
  }
}

export function resolveSocialExecutionSessionBridgeMode(input?: {
  storageConfigured?: boolean;
}): SocialExecutionSessionBridgeMode | "unconfigured" {
  const storageConfigured = input?.storageConfigured ?? isSocialExecutionSessionStoreConfigured();
  if (!storageConfigured) {
    return "unconfigured";
  }

  return isSupabaseServiceConfigured() ? "production" : "reference";
}
