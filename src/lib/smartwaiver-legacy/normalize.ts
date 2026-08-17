import {
  computeExpiresOnYmd,
  signedLocalYmdFromInstant,
} from "@/lib/waivers/expiration";
import { nyLocalDateTimeToUtc } from "@/lib/open-play/business-day";

export function blankToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function assembleDobYmd(
  yearRaw: string | null | undefined,
  monthRaw: string | null | undefined,
  dayRaw: string | null | undefined,
): string | null {
  const year = blankToNull(yearRaw);
  const month = blankToNull(monthRaw);
  const day = blankToNull(dayRaw);
  if (!year || !month || !day) return null;
  if (!/^\d{4}$/.test(year)) return null;
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }
  const ymd = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.toISOString().slice(0, 10) !== ymd) return null;
  return ymd;
}

/**
 * Smartwaiver "Waiver Date" is treated as America/New_York wall time.
 * Incomplete / unparseable dates yield null signedAt (expires still required upstream).
 */
export function parseWaiverDate(raw: string | null | undefined): {
  signedAt: Date | null;
  signedOnYmd: string | null;
  expiresOnYmd: string | null;
} {
  const value = blankToNull(raw);
  if (!value) {
    return { signedAt: null, signedOnYmd: null, expiresOnYmd: null };
  }

  // Common export shapes: "YYYY-MM-DD HH:mm:ss", "M/D/YYYY H:mm", ISO.
  const isoLike = value.includes("T") ? value : value.replace(" ", "T");
  const asDate = new Date(isoLike);
  if (!Number.isNaN(asDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const signedOnYmd = signedLocalYmdFromInstant(asDate);
    return {
      signedAt: asDate,
      signedOnYmd,
      expiresOnYmd: computeExpiresOnYmd(asDate),
    };
  }

  const mdy = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i,
  );
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    let hour = Number(mdy[4] ?? "12");
    const minute = Number(mdy[5] ?? "0");
    const second = Number(mdy[6] ?? "0");
    const ampm = (mdy[7] ?? "").toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const signedAt =
      nyLocalDateTimeToUtc(ymd, hour, minute, second) ??
      new Date(`${ymd}T12:00:00.000Z`);
    return {
      signedAt,
      signedOnYmd: signedLocalYmdFromInstant(signedAt),
      expiresOnYmd: computeExpiresOnYmd(signedAt),
    };
  }

  return { signedAt: null, signedOnYmd: null, expiresOnYmd: null };
}

export function ageYearsOnYmd(dobYmd: string, onYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(onYmd)) {
    return null;
  }
  const [dy, dm, dd] = dobYmd.split("-").map(Number);
  const [oy, om, od] = onYmd.split("-").map(Number);
  let age = oy - dy;
  if (om < dm || (om === dm && od < dd)) age -= 1;
  if (age < 0 || age > 130) return null;
  return age;
}

export function isExplicitTrue(raw: string | null | undefined): boolean {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "y" || v === "on";
}
