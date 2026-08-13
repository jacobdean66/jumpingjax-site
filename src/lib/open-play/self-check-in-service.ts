import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isWaiverExpired } from "@/lib/waivers/expiration";
import { createLegacySmartwaiverCheckIns } from "./legacy-check-in-service";
import { createOpenPlayVisit } from "./visit-service";
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
  waiver_submissions:
    | { status: "completed" | "voided"; expires_on: string }
    | Array<{ status: "completed" | "voided"; expires_on: string }>
    | null;
};

type LegacyRow = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  smartwaiver_legacy_waivers:
    | { activated: boolean; expires_on: string }
    | Array<{ activated: boolean; expires_on: string }>
    | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type PublicWaiverMatch = SelfCheckInSelection & {
  firstName: string;
  lastName: string;
  ageYears: number;
};

async function loadPublicWaiverMatches(options: {
  input: SelfCheckInInput;
  businessDayYmd: string;
}): Promise<PublicWaiverMatch[]> {
  const supabase = createServiceRoleClient();
  const first = options.input.firstName.toLowerCase();
  const last = options.input.lastName.toLowerCase();
  const [nativeResult, legacyResult] = await Promise.all([
    supabase
      .from("waiver_participants")
      .select("id,first_name,last_name,dob,waiver_submissions!inner(status,expires_on)")
      .eq("search_first_name", first)
      .eq("search_last_name", last)
      .limit(10),
    supabase
      .from("smartwaiver_legacy_participants")
      .select("id,first_name,last_name,dob,smartwaiver_legacy_waivers!inner(activated,expires_on)")
      .eq("search_first_name", first)
      .eq("search_last_name", last)
      .limit(10),
  ]);
  if (nativeResult.error) throw new Error("Unable to check waiver records");

  const nativeMatches = ((nativeResult.data ?? []) as NativeRow[]).filter((row) => {
    const waiver = one(row.waiver_submissions);
    return Boolean(
      waiver?.status === "completed" &&
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
        waiver?.activated &&
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
  return rows.map(({ row, source }) => ({
    source,
    participantId: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    ageYears: options.input.ageYears,
  }));
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

  if (selected.source === "native") {
    await createOpenPlayVisit({
      visitDateYmd: options.businessDayYmd,
      staffId: "customer-self-check-in",
      notes: "Customer QR self check-in - admission pending front desk review",
      attendees: [{
        participantId: selected.participantId,
        adultMode: options.input.ageYears >= 18 ? "watching" : null,
        clientPriceCents: null,
        overridePriceCents: 0,
        paymentMethod: "free_pass",
      }],
    });
    return { needsWaiver: false };
  }
  if (selected.source === "legacy") {
    await createLegacySmartwaiverCheckIns({
      visitDateYmd: options.businessDayYmd,
      staffId: "customer-self-check-in",
      notes: "Customer QR self check-in - admission pending front desk review",
      attendees: [{
        legacyParticipantId: selected.participantId,
        participantId: "",
        adultMode: options.input.ageYears >= 18 ? "watching" : null,
        clientPriceCents: null,
        overridePriceCents: 0,
        paymentMethod: "free_pass",
      }],
    });
    return { needsWaiver: false };
  }
  return { needsWaiver: true };
}
