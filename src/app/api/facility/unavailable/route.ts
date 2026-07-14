import { createServiceRoleClient } from "@/lib/supabase/admin";

const FACILITY_TIME_ZONE = "America/New_York";

function getTimeZoneOffsetMs(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FACILITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "0";

  const facilityTimeAsUtc = Date.UTC(
    Number(getPart("year")),
    Number(getPart("month")) - 1,
    Number(getPart("day")),
    Number(getPart("hour")),
    Number(getPart("minute")),
    Number(getPart("second")),
  );

  return facilityTimeAsUtc - value.getTime();
}

function facilityLocalMidnightToUtc(year: number, monthIndex: number, day: number) {
  const utcGuess = new Date(Date.UTC(year, monthIndex, day));
  return new Date(utcGuess.getTime() - getTimeZoneOffsetMs(utcGuess));
}

function getFacilityDayUtcBounds(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);

  return {
    start: facilityLocalMidnightToUtc(year, monthIndex, day).toISOString(),
    end: facilityLocalMidnightToUtc(year, monthIndex, day + 1).toISOString(),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const partyKind = searchParams.get("partyKind");
    const date = searchParams.get("date");

    if (partyKind && partyKind !== "public" && partyKind !== "private") {
      return Response.json([]);
    }
    if (!date) {
      return Response.json([]);
    }
    const bounds = getFacilityDayUtcBounds(date);
    if (!bounds) {
      return Response.json([]);
    }

    const supabase = createServiceRoleClient();
    let query = supabase
      .from("facility_bookings")
      .select("id, party_kind, room, start_time, end_time, status")
      .in("status", ["pending", "confirmed"])
      .gte("start_time", bounds.start)
      .lt("start_time", bounds.end);

    if (partyKind) {
      query = query.eq("party_kind", partyKind);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return Response.json([]);
    }

    return Response.json(data || []);
  } catch (err) {
    console.error("Route crash:", err);
    return Response.json([]);
  }
}
