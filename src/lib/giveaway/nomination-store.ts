import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { GiveawayNominationRow } from "./nomination-email";
import { listFixtureState, saveFixtureNomination, type NominationFixtureState } from "./nomination-fixture-store";

const fixtureGlobal = globalThis as typeof globalThis & { __jumpingJaxNominationFixtures?: NominationFixtureState };
const fixtureState = fixtureGlobal.__jumpingJaxNominationFixtures ?? new Map();
fixtureGlobal.__jumpingJaxNominationFixtures = fixtureState;

export async function saveGiveawayNomination(row: GiveawayNominationRow, mode: "production" | "fixture" = "production") {
  if (mode === "fixture") {
    return saveFixtureNomination(fixtureState, row);
  }

  const supabase = createServiceRoleClient();
  const { data: inserted, error: insertError } = await supabase
    .from("giveaway_nominations")
    .upsert(row, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  if (insertError) throw insertError;
  if (inserted?.id) return { id: String(inserted.id), created: true };

  const { data: existing, error: existingError } = await supabase
    .from("giveaway_nominations")
    .select("id")
    .eq("idempotency_key", row.idempotency_key)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing?.id) throw new Error("Stored nomination could not be confirmed");
  return { id: String(existing.id), created: false };
}

export function listFixtureNominations() {
  return listFixtureState(fixtureState);
}
