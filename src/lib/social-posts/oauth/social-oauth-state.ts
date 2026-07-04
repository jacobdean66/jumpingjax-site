import { createHash, randomBytes, randomUUID } from "node:crypto";

import { SOCIAL_META_OAUTH_VERSION } from "./social-oauth-config";

export const SOCIAL_OAUTH_STATE_VERSION = SOCIAL_META_OAUTH_VERSION;

export type SocialOAuthPkceMaterial = Readonly<{
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}>;

export type SocialOAuthStateMaterial = Readonly<{
  oauthState: string;
  stateRefId: string;
  intentId: string;
  pkce: SocialOAuthPkceMaterial;
}>;

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateOAuthPkceMaterial(): SocialOAuthPkceMaterial {
  const codeVerifier = base64Url(randomBytes(32));
  const digest = createHash("sha256").update(codeVerifier).digest();
  return {
    codeVerifier,
    codeChallenge: base64Url(digest),
    codeChallengeMethod: "S256",
  };
}

export function generateOAuthStateMaterial(): SocialOAuthStateMaterial {
  const pkce = generateOAuthPkceMaterial();
  const oauthState = base64Url(randomBytes(24));
  const stateRefId = `oauth-state-ref:${oauthState.slice(0, 12)}`;
  const intentId = `oauth-intent:${randomUUID()}`;

  return {
    oauthState,
    stateRefId,
    intentId,
    pkce,
  };
}

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
