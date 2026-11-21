import { rateLimit } from "@/lib/rate-limit";
import { CHILD_GENDER_CHOICES, FACILITY_DRINK_CHOICES, PAYMENT_METHOD_CHOICES } from "@/lib/facility-parties/booking-choices";

export const dynamic = "force-dynamic";

// The same choices used by the facility booking form; no booking or customer data.
export async function GET(request: Request) {
  const limited = rateLimit(request, { scope: "receptionist-facility-options", limit: 120, windowMs: 60_000 });
  if (limited) return limited;
  return Response.json({
    schemaVersion: 1,
    drinks: FACILITY_DRINK_CHOICES,
    genders: CHILD_GENDER_CHOICES,
    paymentMethods: PAYMENT_METHOD_CHOICES,
  }, { headers: { "Cache-Control": "no-store" } });
}
