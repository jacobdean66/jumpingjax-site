import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { BirthdayPartyOption } from "./check-in-client";

type PartyRow = {
  id: string;
  child_name: string | null;
  readable_time: string | null;
  room: string | null;
  party_label: string | null;
  status: string | null;
};

export async function loadBirthdayPartiesForDay(
  businessDayYmd: string,
): Promise<BirthdayPartyOption[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select("id,child_name,readable_time,room,party_label,status")
    .eq("readable_date", businessDayYmd)
    .order("start_time", { ascending: true });

  if (error) throw new Error("Unable to load today's birthday parties");

  return ((data ?? []) as PartyRow[])
    .filter((row) => !["cancelled", "canceled"].includes(row.status?.trim().toLowerCase() ?? ""))
    .filter((row) => Boolean(row.child_name?.trim()))
    .map((row) => {
      const childName = row.child_name!.trim();
      const details = [row.readable_time, row.room, row.party_label]
        .map((value) => value?.trim())
        .filter(Boolean)
        .join(" · ");
      return {
        id: row.id,
        childName,
        label: details ? `${childName} — ${details}` : childName,
      };
    });
}
