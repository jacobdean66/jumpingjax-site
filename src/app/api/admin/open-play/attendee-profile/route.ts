import { NextResponse } from "next/server";

import { requireOwnerAuth, publicSafeError } from "@/lib/open-play/staff-auth";
import { isYmd } from "@/lib/open-play/pricing";
import { rateLimit } from "@/lib/rate-limit";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-open-play-attendee-profile",
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const auth = await requireOwnerAuth();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return publicSafeError("validation", 400, "Enter valid child details.");
  }

  const input = body as Record<string, unknown>;
  const participantId = String(input.participantId ?? "").trim();
  const source = String(input.source ?? "");
  const firstName = String(input.firstName ?? "").trim();
  const lastName = String(input.lastName ?? "").trim();
  const birthDate = String(input.birthDate ?? "").trim();

  if (
    source !== "legacy_smartwaiver" ||
    !UUID.test(participantId) ||
    !firstName ||
    !lastName ||
    firstName.length > 100 ||
    lastName.length > 100 ||
    !isYmd(birthDate) ||
    birthDate > new Date().toISOString().slice(0, 10)
  ) {
    return publicSafeError("validation", 400, "Check the name and birthday, then try again.");
  }

  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("smartwaiver_legacy_participants")
      .update({ first_name: firstName, last_name: lastName, dob: birthDate })
      .eq("id", participantId)
      .select("id, first_name, last_name, dob")
      .single();

    if (error || !data) {
      return publicSafeError("database", 503, "The child details could not be saved.");
    }

    return NextResponse.json(
      {
        ok: true,
        profile: {
          participantId: data.id,
          firstName: data.first_name,
          lastName: data.last_name,
          birthDate: data.dob,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return publicSafeError("database", 503, "The child details could not be saved.");
  }
}
