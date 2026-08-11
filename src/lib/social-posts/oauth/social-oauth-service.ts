import { createServiceRoleClient, isSupabaseServiceConfigured } from "../../supabase/admin";
import {
  META_AD_ANALYTICS_OAUTH_TARGET_ID,
  SOCIAL_OAUTH_INTENT_TTL_MS,
  buildMetaOAuthCallbackUri,
  isAllowlistedOAuthReturnPath,
  isSocialOAuthConnectConfigured,
  oauthReturnPathForPurpose,
  resolveOAuthPurposeFromIntent,
  resolveSocialOAuthRuntimeConfig,
  scopesForOAuthPurpose,
  type SocialMetaOAuthPurpose,
  type SocialOAuthRuntimeConfig,
} from "./social-oauth-config";
import {
  encryptOAuthSecret,
  serializeOAuthEnvelope,
} from "./social-oauth-credential-envelope";
import {
  buildMetaAuthorizeUrl,
  exchangeMetaAuthorizationCode,
  redactMetaAccountId,
  validateMetaRedirectUri,
} from "./social-meta-oauth-client";
import {
  constantTimeEqual,
  generateOAuthStateMaterial,
  type SocialOAuthStateMaterial,
} from "./social-oauth-state";
import { persistMetaOAuthTokensToVault } from "./social-oauth-vault-integration";

export const SOCIAL_OAUTH_CALLBACK_OUTCOMES = [
  "success",
  "denied",
  "canceled",
  "provider_error",
  "state_mismatch",
  "expired",
  "exchange_failed",
  "vault_write_failed",
  "disabled",
] as const;

export type SocialOAuthCallbackOutcome =
  (typeof SOCIAL_OAUTH_CALLBACK_OUTCOMES)[number];

export type SocialOAuthAuthorizationIntentRow = Readonly<{
  intent_id: string;
  oauth_state: string;
  state_ref_id: string;
  provider: "meta";
  publication_target_id: string;
  redirect_uri: string;
  scopes: readonly string[];
  pkce_challenge: string;
  encrypted_verifier_ref: string;
  admin_actor_id: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}>;

export type SocialOAuthCallbackEventRow = Readonly<{
  callback_event_id: string;
  intent_id: string;
  outcome: SocialOAuthCallbackOutcome;
  error_code_redacted: string | null;
  provider_account_id_redacted: string | null;
  access_credential_ref_id: string | null;
  refresh_credential_ref_id: string | null;
  lifecycle_state_id: string | null;
  created_at: string;
}>;

export type SocialOAuthSessionRow = Readonly<{
  session_id: string;
  intent_id: string;
  provider: "meta";
  publication_target_id: string;
  lifecycle_state:
    | "awaiting_callback"
    | "connected"
    | "denied"
    | "canceled"
    | "provider_error"
    | "state_mismatch"
    | "expired"
    | "failed";
  access_credential_ref_id: string | null;
  refresh_credential_ref_id: string | null;
  provider_account_id: string | null;
  callback_event_id: string | null;
  admin_actor_id: string;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}>;

export type SocialOAuthConnectResult = Readonly<
  | {
      ok: true;
      authorizeUrl: string;
      intentId: string;
      stateRefId: string;
      purpose: SocialMetaOAuthPurpose;
    }
  | { ok: false; code: string; message: string }
>;

export type SocialOAuthCallbackResult = Readonly<
  | {
      ok: true;
      outcome: "success";
      redirectPath: string;
      sessionId: string;
      accessCredentialRefId: string;
      purpose: SocialMetaOAuthPurpose;
    }
  | {
      ok: false;
      outcome: Exclude<SocialOAuthCallbackOutcome, "success">;
      redirectPath: string;
      message: string;
      purpose: SocialMetaOAuthPurpose;
    }
>;

export function isSocialOAuthStoreConfigured(): boolean {
  return isSupabaseServiceConfigured();
}

function sanitizeCallbackMessage(message: string): string {
  return message
    .replace(/(access[_-]?token|bearer\s+[a-z0-9._-]+|EAAG[A-Za-z0-9]+)/gi, "[redacted]")
    .replace(/[?&](code|state)=[^&\s]+/gi, "")
    .slice(0, 280);
}

function buildPurposeRedirect(
  purpose: SocialMetaOAuthPurpose,
  oauthStatus: string,
): string {
  const params = new URLSearchParams({ oauth: oauthStatus, provider: "meta" });
  const path = oauthReturnPathForPurpose(purpose, params.toString());
  return isAllowlistedOAuthReturnPath(path)
    ? path
    : oauthReturnPathForPurpose(purpose, "oauth=provider_error");
}

export async function createMetaOAuthConnectIntent(input: {
  publicationTargetId: string;
  adminActorId: string;
  purpose?: SocialMetaOAuthPurpose;
  config?: SocialOAuthRuntimeConfig;
}): Promise<SocialOAuthConnectResult> {
  const purpose = input.purpose ?? "publication";
  const config = input.config ?? resolveSocialOAuthRuntimeConfig();
  if (!isSocialOAuthConnectConfigured(config)) {
    return {
      ok: false,
      code: "oauth_not_configured",
      message: "Meta OAuth connect is not configured or disabled.",
    };
  }
  if (!isSocialOAuthStoreConfigured()) {
    return {
      ok: false,
      code: "storage_unavailable",
      message: "OAuth intent storage is not configured.",
    };
  }

  const redirectUri = buildMetaOAuthCallbackUri(config);
  if (!redirectUri || !config.metaAppId || !config.vaultMasterKey) {
    return {
      ok: false,
      code: "oauth_not_configured",
      message: "Meta OAuth redirect configuration is incomplete.",
    };
  }

  const publicationTargetId =
    purpose === "ad_analytics"
      ? META_AD_ANALYTICS_OAUTH_TARGET_ID
      : input.publicationTargetId.trim();
  if (!publicationTargetId) {
    return {
      ok: false,
      code: "publication_target_required",
      message: "publication_target_id is required for publication OAuth.",
    };
  }

  const scopes = scopesForOAuthPurpose(purpose);
  const stateMaterial = generateOAuthStateMaterial();
  const encryptedVerifier = serializeOAuthEnvelope(
    encryptOAuthSecret(stateMaterial.pkce.codeVerifier, config.vaultMasterKey),
  );
  const expiresAt = new Date(Date.now() + SOCIAL_OAUTH_INTENT_TTL_MS).toISOString();

  const client = createServiceRoleClient();
  const { error: intentError } = await client.from("social_oauth_authorization_intents").insert({
    intent_id: stateMaterial.intentId,
    oauth_state: stateMaterial.oauthState,
    state_ref_id: stateMaterial.stateRefId,
    provider: "meta",
    publication_target_id: publicationTargetId,
    redirect_uri: redirectUri,
    scopes: [...scopes],
    pkce_challenge: stateMaterial.pkce.codeChallenge,
    encrypted_verifier_ref: encryptedVerifier,
    admin_actor_id: input.adminActorId,
    expires_at: expiresAt,
  });
  if (intentError) {
    return {
      ok: false,
      code: "intent_create_failed",
      message: intentError.message,
    };
  }

  const sessionId = `oauth-session:${stateMaterial.intentId}`;
  const { error: sessionError } = await client.from("social_oauth_sessions").insert({
    session_id: sessionId,
    intent_id: stateMaterial.intentId,
    provider: "meta",
    publication_target_id: publicationTargetId,
    lifecycle_state: "awaiting_callback",
    admin_actor_id: input.adminActorId,
  });
  if (sessionError) {
    return {
      ok: false,
      code: "session_create_failed",
      message: sessionError.message,
    };
  }

  const authorizeUrl = buildMetaAuthorizeUrl({
    appId: config.metaAppId,
    redirectUri,
    oauthState: stateMaterial.oauthState,
    scopes,
  });

  return {
    ok: true,
    authorizeUrl,
    intentId: stateMaterial.intentId,
    stateRefId: stateMaterial.stateRefId,
    purpose,
  };
}

export async function handleMetaOAuthCallback(input: {
  oauthState: string | null;
  authorizationCode: string | null;
  error: string | null;
  errorReason: string | null;
  purposeHint?: SocialMetaOAuthPurpose | null;
  config?: SocialOAuthRuntimeConfig;
}): Promise<SocialOAuthCallbackResult> {
  const config = input.config ?? resolveSocialOAuthRuntimeConfig();
  const fallbackPurpose: SocialMetaOAuthPurpose =
    input.purposeHint === "ad_analytics" ? "ad_analytics" : "publication";

  if (!config.oauthEnabled || !config.metaOAuthEnabled) {
    return finalizeCallback({
      purpose: fallbackPurpose,
      redirectPath: buildPurposeRedirect(fallbackPurpose, "disabled"),
      outcome: "disabled",
      message: "OAuth is disabled.",
    });
  }

  if (input.error === "access_denied") {
    return finalizeCallback({
      purpose: fallbackPurpose,
      redirectPath: buildPurposeRedirect(fallbackPurpose, "denied"),
      outcome: "denied",
      message: sanitizeCallbackMessage(
        input.errorReason ?? "Owner denied Meta authorization.",
      ),
    });
  }

  if (!input.oauthState || !input.authorizationCode) {
    return finalizeCallback({
      purpose: fallbackPurpose,
      redirectPath: buildPurposeRedirect(fallbackPurpose, "provider_error"),
      outcome: "provider_error",
      message: "Meta callback was missing state or authorization code.",
    });
  }

  if (
    !isSocialOAuthStoreConfigured() ||
    !config.vaultMasterKey ||
    !config.metaAppId ||
    !config.metaAppSecret
  ) {
    return finalizeCallback({
      purpose: fallbackPurpose,
      redirectPath: buildPurposeRedirect(fallbackPurpose, "exchange_failed"),
      outcome: "exchange_failed",
      message: "OAuth storage or Meta configuration is unavailable.",
    });
  }

  const client = createServiceRoleClient();
  const { data: intentRow, error: intentError } = await client
    .from("social_oauth_authorization_intents")
    .select("*")
    .eq("oauth_state", input.oauthState)
    .maybeSingle();

  if (intentError || !intentRow) {
    return finalizeCallback({
      purpose: fallbackPurpose,
      redirectPath: buildPurposeRedirect(fallbackPurpose, "state_mismatch"),
      outcome: "state_mismatch",
      message: "OAuth state could not be matched to a pending intent.",
    });
  }

  const intent = intentRow as SocialOAuthAuthorizationIntentRow;
  const purpose = resolveOAuthPurposeFromIntent({
    publicationTargetId: intent.publication_target_id,
    scopes: intent.scopes,
  });

  if (!constantTimeEqual(intent.oauth_state, input.oauthState)) {
    return recordAndReturn(client, intent, purpose, {
      redirectPath: buildPurposeRedirect(purpose, "state_mismatch"),
      outcome: "state_mismatch",
      message: "OAuth state mismatch.",
    });
  }

  if (intent.consumed_at) {
    const idempotentSuccess = await loadConnectedOAuthCallbackSuccess(
      client,
      intent.intent_id,
      purpose,
    );
    if (idempotentSuccess) return idempotentSuccess;

    return finalizeCallback({
      purpose,
      redirectPath: buildPurposeRedirect(purpose, "provider_error"),
      outcome: "provider_error",
      message: "OAuth intent was already consumed.",
    });
  }

  if (Date.parse(intent.expires_at) < Date.now()) {
    return recordAndReturn(client, intent, purpose, {
      redirectPath: buildPurposeRedirect(purpose, "expired"),
      outcome: "expired",
      message: "OAuth intent expired before callback completed.",
    });
  }

  if (!validateMetaRedirectUri(intent.redirect_uri, config)) {
    return recordAndReturn(client, intent, purpose, {
      redirectPath: buildPurposeRedirect(purpose, "provider_error"),
      outcome: "provider_error",
      message: "OAuth redirect URI is not allowlisted.",
    });
  }

  const exchange = await exchangeMetaAuthorizationCode({
    appId: config.metaAppId,
    appSecret: config.metaAppSecret,
    redirectUri: intent.redirect_uri,
    authorizationCode: input.authorizationCode,
  });

  if (!exchange.ok) {
    return recordAndReturn(client, intent, purpose, {
      redirectPath: buildPurposeRedirect(purpose, "exchange_failed"),
      outcome: "exchange_failed",
      message: sanitizeCallbackMessage(exchange.message),
      errorCode: exchange.errorCode,
    });
  }

  const vaultWrite = await persistMetaOAuthTokensToVault({
    publicationTargetId: intent.publication_target_id,
    accessToken: exchange.accessToken,
    expiresInSeconds: exchange.expiresInSeconds,
    adminActorId: intent.admin_actor_id,
    config,
  });

  if (!vaultWrite.ok) {
    return recordAndReturn(client, intent, purpose, {
      redirectPath: buildPurposeRedirect(purpose, "vault_write_failed"),
      outcome: "vault_write_failed",
      message: sanitizeCallbackMessage(vaultWrite.message),
      errorCode: vaultWrite.code,
    });
  }

  const callbackEventId = `oauth-callback:${intent.intent_id}`;
  await client.from("social_oauth_callback_events").insert({
    callback_event_id: callbackEventId,
    intent_id: intent.intent_id,
    outcome: "success",
    provider_account_id_redacted: redactMetaAccountId(intent.publication_target_id),
    access_credential_ref_id: vaultWrite.accessCredentialRefId,
    refresh_credential_ref_id: vaultWrite.refreshCredentialRefId,
    lifecycle_state_id: vaultWrite.lifecycleStateId,
  });

  await client
    .from("social_oauth_authorization_intents")
    .update({ consumed_at: new Date().toISOString() })
    .eq("intent_id", intent.intent_id);

  const sessionId = `oauth-session:${intent.intent_id}`;
  await client
    .from("social_oauth_sessions")
    .update({
      lifecycle_state: "connected",
      access_credential_ref_id: vaultWrite.accessCredentialRefId,
      refresh_credential_ref_id: vaultWrite.refreshCredentialRefId,
      provider_account_id: vaultWrite.providerAccountId,
      callback_event_id: callbackEventId,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  return {
    ok: true,
    outcome: "success",
    redirectPath: buildPurposeRedirect(purpose, "connected"),
    sessionId,
    accessCredentialRefId: vaultWrite.accessCredentialRefId,
    purpose,
  };
}

async function loadConnectedOAuthCallbackSuccess(
  client: ReturnType<typeof createServiceRoleClient>,
  intentId: string,
  purpose: SocialMetaOAuthPurpose,
): Promise<SocialOAuthCallbackResult | null> {
  const { data: sessionRow } = await client
    .from("social_oauth_sessions")
    .select("session_id, lifecycle_state, access_credential_ref_id")
    .eq("intent_id", intentId)
    .maybeSingle();

  if (
    !sessionRow ||
    sessionRow.lifecycle_state !== "connected" ||
    !sessionRow.access_credential_ref_id
  ) {
    return null;
  }

  return {
    ok: true,
    outcome: "success",
    redirectPath: buildPurposeRedirect(purpose, "connected"),
    sessionId: sessionRow.session_id,
    accessCredentialRefId: sessionRow.access_credential_ref_id,
    purpose,
  };
}

async function recordAndReturn(
  client: ReturnType<typeof createServiceRoleClient>,
  intent: SocialOAuthAuthorizationIntentRow,
  purpose: SocialMetaOAuthPurpose,
  input: {
    redirectPath: string;
    outcome: Exclude<SocialOAuthCallbackOutcome, "success">;
    message: string;
    errorCode?: string;
  },
): Promise<SocialOAuthCallbackResult> {
  const idempotentSuccess = await loadConnectedOAuthCallbackSuccess(
    client,
    intent.intent_id,
    purpose,
  );
  if (idempotentSuccess) return idempotentSuccess;

  const callbackEventId = `oauth-callback:${intent.intent_id}:${input.outcome}`;
  await client.from("social_oauth_callback_events").insert({
    callback_event_id: callbackEventId,
    intent_id: intent.intent_id,
    outcome: input.outcome,
    error_code_redacted: input.errorCode ?? input.outcome,
  });

  const lifecycleState =
    input.outcome === "denied"
      ? "denied"
      : input.outcome === "canceled"
        ? "canceled"
        : input.outcome === "expired"
          ? "expired"
          : input.outcome === "state_mismatch"
            ? "state_mismatch"
            : "failed";

  await client
    .from("social_oauth_sessions")
    .update({
      lifecycle_state: lifecycleState,
      callback_event_id: callbackEventId,
      updated_at: new Date().toISOString(),
    })
    .eq("intent_id", intent.intent_id);

  return finalizeCallback({
    purpose,
    redirectPath: input.redirectPath,
    outcome: input.outcome,
    message: sanitizeCallbackMessage(input.message),
  });
}

function finalizeCallback(input: {
  purpose: SocialMetaOAuthPurpose;
  redirectPath: string;
  outcome: Exclude<SocialOAuthCallbackOutcome, "success">;
  message: string;
}): SocialOAuthCallbackResult {
  return {
    ok: false,
    outcome: input.outcome,
    redirectPath: input.redirectPath,
    message: sanitizeCallbackMessage(input.message),
    purpose: input.purpose,
  };
}

export async function loadSocialOAuthPersistenceSnapshot(): Promise<
  Readonly<{
    intents: readonly SocialOAuthAuthorizationIntentRow[];
    callbackEvents: readonly SocialOAuthCallbackEventRow[];
    sessions: readonly SocialOAuthSessionRow[];
  }>
> {
  if (!isSocialOAuthStoreConfigured()) {
    return { intents: [], callbackEvents: [], sessions: [] };
  }

  const client = createServiceRoleClient();
  const [intents, callbackEvents, sessions] = await Promise.all([
    client
      .from("social_oauth_authorization_intents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("social_oauth_callback_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("social_oauth_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  return {
    intents: (intents.data ?? []) as SocialOAuthAuthorizationIntentRow[],
    callbackEvents: (callbackEvents.data ?? []) as SocialOAuthCallbackEventRow[],
    sessions: (sessions.data ?? []) as SocialOAuthSessionRow[],
  };
}

export type { SocialOAuthStateMaterial };
