import { rateLimit } from "@/lib/rate-limit";
import { FACILITY_BALANCE_DUE, FACILITY_DEPOSIT_CENTS, FACILITY_DEPOSIT_DUE } from "@/lib/facility-parties/booking-terms";

export const dynamic = "force-dynamic";

// Terms for the positive-price facility packages, without a booking action.
export async function GET(request: Request) {
  const limited = rateLimit(request, { scope: "receptionist-facility-terms", limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  return Response.json({
    schemaVersion: 1,
    depositCents: FACILITY_DEPOSIT_CENTS,
    dueDescription: FACILITY_DEPOSIT_DUE,
    balanceDescription: FACILITY_BALANCE_DUE,
  }, { headers: { "Cache-Control": "no-store" } });
}
