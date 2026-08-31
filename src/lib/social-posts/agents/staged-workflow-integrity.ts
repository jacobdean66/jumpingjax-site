import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SocialDraftCheckpoint } from "./staged-workflow-types";

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET must be configured for Social Agent checkpoints.");
  }
  return value;
}

function signature(checkpoint: SocialDraftCheckpoint, actorId: string): string {
  return createHmac("sha256", secret())
    .update(`${actorId}\n${JSON.stringify(checkpoint)}`)
    .digest("base64url");
}

export function signSocialDraftCheckpoint(
  checkpoint: SocialDraftCheckpoint,
  actorId: string,
): string {
  return signature(checkpoint, actorId);
}

export function verifySocialDraftCheckpointSignature(
  checkpoint: SocialDraftCheckpoint,
  actorId: string,
  supplied: string | null | undefined,
): boolean {
  if (!supplied) return false;
  const expected = signature(checkpoint, actorId);
  const actualBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}
