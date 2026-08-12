import { NextResponse } from "next/server";

import { InMemoryAuditLog } from "@/lib/ai-receptionist/audit";
import {
  SimRentalAvailabilityAdapter,
  SimRentalBookingAdapter,
} from "@/lib/ai-receptionist/adapters/booking";
import { SimPaymentLinkAdapter } from "@/lib/ai-receptionist/adapters/payment-link";
import { CallSessionOrchestrator } from "@/lib/ai-receptionist/orchestrator";
import {
  sanitizeAuditForOwnerDemo,
  sanitizeSessionForOwnerDemo,
  sanitizeTurnForOwnerDemo,
} from "@/lib/ai-receptionist/sanitize";
import {
  getForcedSimulationConfig,
  SIMULATION_BANNER,
} from "@/lib/ai-receptionist/simulation-mode";
import { requireOwnerAuth } from "@/lib/open-play/staff-auth";
import { rateLimit } from "@/lib/rate-limit";
import type { CallIntent, CallTurnInput } from "@/lib/ai-receptionist/types";

export const dynamic = "force-dynamic";

const config = getForcedSimulationConfig();
const audit = new InMemoryAuditLog();
const availability = new SimRentalAvailabilityAdapter();
const booking = new SimRentalBookingAdapter();
const paymentLinks = new SimPaymentLinkAdapter(config);
const orchestrator = new CallSessionOrchestrator({
  audit,
  availability,
  booking,
  paymentLinks,
  config,
});

type Body = {
  sessionId?: string;
  text?: string;
  confidence?: number;
  intent?: CallIntent;
  availability?: CallTurnInput["availability"];
  booking?: CallTurnInput["booking"];
  payment?: CallTurnInput["payment"];
  start?: boolean;
  callerE164?: string | null;
  seedUnavailable?: { rentalItem: string; ymds: string[] };
};

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "ai-receptionist-simulate-call",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await requireOwnerAuth();
  if (!auth.ok) return auth.response;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.seedUnavailable?.rentalItem && Array.isArray(body.seedUnavailable.ymds)) {
    availability.setUnavailable(
      body.seedUnavailable.rentalItem.trim(),
      body.seedUnavailable.ymds,
    );
  }

  if (body.start) {
    const session = orchestrator.startSession(body.callerE164 ?? null);
    return NextResponse.json({
      ok: true,
      banner: SIMULATION_BANNER,
      liveActions: false,
      session: sanitizeSessionForOwnerDemo(session),
    });
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const text = typeof body.text === "string" ? body.text : "";
  if (!sessionId || !text.trim()) {
    return NextResponse.json(
      { ok: false, error: "sessionId and text are required (or start: true)" },
      { status: 400 },
    );
  }

  const confidence =
    typeof body.confidence === "number" && Number.isFinite(body.confidence)
      ? Math.min(1, Math.max(0, body.confidence))
      : 0.9;

  const turn = await orchestrator.handleTurn({
    sessionId,
    text,
    confidence,
    intent: body.intent,
    availability: body.availability,
    booking: body.booking,
    payment: body.payment,
  });

  return NextResponse.json({
    ok: true,
    banner: SIMULATION_BANNER,
    liveActions: false,
    turn: sanitizeTurnForOwnerDemo(turn),
    audit: sanitizeAuditForOwnerDemo(audit.list(sessionId)),
  });
}
