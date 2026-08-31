import "server-only";

import {
  signAdminScopedPayload,
  verifyAdminScopedPayload,
} from "@/lib/admin/delivery-auth";
import type { SocialDraftCheckpoint } from "./staged-workflow-types";

function payload(checkpoint: SocialDraftCheckpoint, actorId: string): string {
  return `${actorId}\n${JSON.stringify(checkpoint)}`;
}

export function signSocialDraftCheckpoint(
  checkpoint: SocialDraftCheckpoint,
  actorId: string,
): string {
  const signed = signAdminScopedPayload(
    "social-draft-checkpoint",
    payload(checkpoint, actorId),
  );
  if (!signed) {
    throw new Error("Admin session signing is not configured for Social Agent checkpoints.");
  }
  return signed;
}

export function verifySocialDraftCheckpointSignature(
  checkpoint: SocialDraftCheckpoint,
  actorId: string,
  supplied: string | null | undefined,
): boolean {
  return verifyAdminScopedPayload(
    "social-draft-checkpoint",
    payload(checkpoint, actorId),
    supplied,
  );
}
