import type { SupabaseClient } from "@supabase/supabase-js";

import {
  facilityPublicAvailabilityQuery,
  type FacilityAvailabilityRow,
} from "./availability-source";

export async function loadPublicFacilityAvailabilityRows(
  supabase: SupabaseClient,
  date: string,
): Promise<
  | { ok: true; rows: FacilityAvailabilityRow[] }
  | { ok: false; error: string }
> {
  const spec = facilityPublicAvailabilityQuery(date);
  const { data, error } = await supabase
    .from(spec.table)
    .select(spec.columns)
    .in("status", [...spec.statuses])
    .gte("start_time", spec.startInclusive)
    .lt("start_time", spec.endExclusive);

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    rows: (data ?? []) as FacilityAvailabilityRow[],
  };
}
