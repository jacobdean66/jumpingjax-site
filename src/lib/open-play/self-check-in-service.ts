import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isWaiverExpired } from "@/lib/waivers/expiration";
import { runDeskCommand } from "./desk-service";
import { loadBirthdayPartiesForDay } from "./birthday-parties";
import { findAndAddFacilityPartyGuest, setFacilityPartyGuestPresent } from "@/lib/facility-parties/check-in-service";
import { ageInCompletedYearsOnDate } from "./pricing";
import {
  dobMatchesAge,
  type SelfCheckInInput,
  type SelfCheckInSelection,
} from "./self-check-in";

type NativeRow = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  role: "child" | "adult_signer" | "adult_covered";
  original_first_name?: string;
  original_last_name?: string;
  waiver_submissions:
    | { status: "completed" | "voided"; expires_on: string; signed_at: string }
    | Array<{ status: "completed" | "voided"; expires_on: string; signed_at: string }>
    | null;
};

type LegacyRow = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  role: "child" | "adult_signer" | "adult_covered";
  original_first_name?: string;
  original_last_name?: string;
  smartwaiver_legacy_waivers:
    | { activated: boolean; expires_on: string; signed_at: string | null; signed_on_ymd: string | null }
    | Array<{ activated: boolean; expires_on: string; signed_at: string | null; signed_on_ymd: string | null }>
    | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type PublicWaiverMatch = Omit<SelfCheckInSelection, "paymentMethod" | "birthdayPartyId"> & {
  firstName: string;
  lastName: string;
  ageYears: number;
  dobYmd: string;
};

async function loadPublicWaiverMatches(options: {
  input: SelfCheckInInput;
  businessDayYmd: string;
}): Promise<PublicWaiverMatch[]> {
  const supabase = createServiceRoleClient();
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const first = normalize(options.input.firstName);
  const last = normalize(options.input.lastName);
  const [nativeRpc, legacyRpc] = await Promise.all([
    supabase.rpc("search_waiver_participants_for_staff", { p_query: `${first} ${last}`, p_limit: 25 }),
    supabase.rpc("search_smartwaiver_legacy_participants_for_staff", { p_query: `${first} ${last}`, p_limit: 25 }),
  ]);
  type MatchRow = { participant_id?: string; legacy_participant_id?: string; first_name: string; last_name: string; original_first_name?: string; original_last_name?: string; dob: string; role: NativeRow["role"]; expires_on: string };
  const nativeResult = { error: nativeRpc.error, data: ((nativeRpc.data ?? []) as MatchRow[]).map(row => ({ ...row, id: row.participant_id!, waiver_submissions: { status: "completed" as const, expires_on: row.expires_on, signed_at: "" } })) };
  const legacyResult = { error: legacyRpc.error, data: ((legacyRpc.data ?? []) as MatchRow[]).map(row => ({ ...row, id: row.legacy_participant_id!, smartwaiver_legacy_waivers: { activated: true, expires_on: row.expires_on, signed_at: "", signed_on_ymd: "" } })) };
  const nameMatches = (row: NativeRow | LegacyRow) =>
    (normalize(row.first_name) === first && normalize(row.last_name) === last) ||
    (normalize(row.original_first_name ?? row.first_name) === first && normalize(row.original_last_name ?? row.last_name) === last);
  if (nativeResult.error || legacyResult.error) throw new Error("Unable to check waiver records");

  const nativeMatches = ((nativeResult.data ?? []) as NativeRow[]).filter((row) => {
    const waiver = one(row.waiver_submissions);
    return Boolean(
      nameMatches(row) && waiver?.status === "completed" &&
        !isWaiverExpired({
          expiresOnYmd: waiver.expires_on,
          evaluationLocalYmd: options.businessDayYmd,
        }) &&
        dobMatchesAge(row.dob, options.businessDayYmd, options.input.ageYears),
    );
  });
  const legacyMatches = (legacyResult.error ? [] : ((legacyResult.data ?? []) as LegacyRow[])).filter(
    (row) => {
      const waiver = one(row.smartwaiver_legacy_waivers);
      return Boolean(
        nameMatches(row) && waiver?.activated &&
          !isWaiverExpired({
            expiresOnYmd: waiver.expires_on,
            evaluationLocalYmd: options.businessDayYmd,
          }) &&
          dobMatchesAge(row.dob, options.businessDayYmd, options.input.ageYears),
      );
    },
  );

  // Native records take precedence over imported Smartwaiver duplicates.
  const rows = nativeMatches.length
    ? nativeMatches.map((row) => ({ row, source: "native" as const }))
    : legacyMatches.map((row) => ({ row, source: "legacy" as const }));
  const newestFirst = rows
    .map(({ row, source }) => {
      const waiver = source === "native"
        ? one((row as NativeRow).waiver_submissions)
        : one((row as LegacyRow).smartwaiver_legacy_waivers);
      const signedAt = source === "native"
        ? (waiver as { signed_at?: string } | null)?.signed_at ?? ""
        : (waiver as { signed_at?: string | null; signed_on_ymd?: string | null } | null)?.signed_at ??
          (waiver as { signed_on_ymd?: string | null } | null)?.signed_on_ymd ??
          "";
      return {
        source,
        participantId: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        ageYears: ageInCompletedYearsOnDate(row.dob ?? "", options.businessDayYmd),
        dobYmd: row.dob ?? "",
        signedAt,
      };
    })
    .sort((a, b) => b.signedAt.localeCompare(a.signedAt));
  const unique = new Map<string, PublicWaiverMatch>();
  for (const match of newestFirst) {
    const identity = `${match.firstName.trim().toLowerCase()}|${match.lastName.trim().toLowerCase()}|${match.dobYmd}`;
    if (!unique.has(identity)) {
      unique.set(identity, {
        source: match.source,
        participantId: match.participantId,
        firstName: match.firstName,
        lastName: match.lastName,
        ageYears: match.ageYears,
        dobYmd: match.dobYmd,
      });
    }
  }
  return [...unique.values()];
}

export async function findPublicWaiverMatches(options: {
  input: SelfCheckInInput;
  businessDayYmd: string;
}): Promise<PublicWaiverMatch[]> {
  return loadPublicWaiverMatches(options);
}

export async function createPublicSelfCheckIn(options: {
  input: SelfCheckInInput;
  selection: SelfCheckInSelection;
  businessDayYmd: string;
}): Promise<{ needsWaiver: boolean }> {
  const matches = await loadPublicWaiverMatches(options);
  const selected = matches.find(
    (match) =>
      match.source === options.selection.source &&
      match.participantId === options.selection.participantId,
  );
  if (!selected) return { needsWaiver: true };

  const birthdayParty = options.selection.paymentMethod === "birthday_party"
    ? (await loadBirthdayPartiesForDay(options.businessDayYmd)).find(
        (party) => party.id === options.selection.birthdayPartyId,
      ) ?? null
    : null;
  if (options.selection.paymentMethod === "birthday_party" && !birthdayParty) {
    throw new Error("Birthday party is not available today");
  }
  if (selected.source === "native") {
    await runDeskCommand(options.businessDayYmd, "mark_here", "customer-self-check-in", {
      source: "native", participantId: selected.participantId,
    });
    if (birthdayParty) {
      try {
        const partyGuest = await findAndAddFacilityPartyGuest({
          bookingId: birthdayParty.id,
          firstName: selected.firstName,
          lastName: selected.lastName,
          dob: selected.dobYmd,
          partyDate: options.businessDayYmd,
        });
        if (partyGuest.ok && partyGuest.found) {
          await setFacilityPartyGuestPresent({
            bookingId: birthdayParty.id,
            guestId: partyGuest.guest.id,
            present: true,
            staffLabel: "Customer kiosk",
          });
        }
      } catch {
        // The Open Play attendance record is authoritative; party guest sync is best effort.
      }
    }
    return { needsWaiver: false };
  }
  if (selected.source === "legacy") {
    await runDeskCommand(options.businessDayYmd, "mark_here", "customer-self-check-in", {
      source: "legacy_smartwaiver", participantId: selected.participantId,
    });
    return { needsWaiver: false };
  }
  return { needsWaiver: true };
}
