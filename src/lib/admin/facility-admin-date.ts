const ADMIN_TIME_ZONE = "America/New_York";

function getTimeZoneOffsetMs(value: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ADMIN_TIME_ZONE,
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

  const zonedTimeAsUtc = Date.UTC(
    Number(getPart("year")),
    Number(getPart("month")) - 1,
    Number(getPart("day")),
    Number(getPart("hour")),
    Number(getPart("minute")),
    Number(getPart("second")),
  );

  return zonedTimeAsUtc - value.getTime();
}

function localMidnightToUtc(year: number, monthIndex: number, day: number): Date {
  const utcGuess = new Date(Date.UTC(year, monthIndex, day));
  return new Date(utcGuess.getTime() - getTimeZoneOffsetMs(utcGuess));
}

export function facilityAdminUtcBoundsForYmdRange(input: {
  from: string;
  to: string;
}): { start: string; endExclusive: string } {
  const [fromYear, fromMonth, fromDay] = input.from.split("-").map(Number);
  const [toYear, toMonth, toDay] = input.to.split("-").map(Number);

  return {
    start: localMidnightToUtc(
      fromYear ?? 0,
      (fromMonth ?? 1) - 1,
      fromDay ?? 1,
    ).toISOString(),
    endExclusive: localMidnightToUtc(
      toYear ?? 0,
      (toMonth ?? 1) - 1,
      (toDay ?? 1) + 1,
    ).toISOString(),
  };
}
