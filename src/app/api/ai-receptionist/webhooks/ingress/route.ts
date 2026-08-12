import { NextResponse } from "next/server";

import { getAiReceptionistConfig } from "@/lib/ai-receptionist/config";
import {
  liveActionsDisabledResponse,
  verifyWebhookSignatureStub,
} from "@/lib/ai-receptionist/security";

export const dynamic = "force-dynamic";

/**
 * Live telephony webhook ingress stub.
 * Phase 1 always refuses unless live actions are enabled AND verification is implemented.
 */
export async function POST(req: Request) {
  const config = getAiReceptionistConfig();
  if (!config.liveActions) {
    return NextResponse.json(liveActionsDisabledResponse("webhook.ingress"), {
      status: 503,
    });
  }

  const signature =
    req.headers.get("x-ai-receptionist-signature") ??
    req.headers.get("x-twilio-signature") ??
    null;

  const verified = verifyWebhookSignatureStub({
    liveActions: config.liveActions,
    providedSignature: signature,
    expectedSecretConfigured: Boolean(
      process.env.AI_RECEPTIONIST_WEBHOOK_SECRET?.trim(),
    ),
  });

  if (!verified.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: verified.code,
        error: "Webhook rejected. Live provider verification is not production-ready.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      code: "live_provider_not_wired",
      error: "Live telephony provider is not implemented in Phase 1.",
    },
    { status: 501 },
  );
}
