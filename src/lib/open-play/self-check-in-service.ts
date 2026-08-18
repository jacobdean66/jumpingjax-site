import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isWaiverExpired } from "@/lib/waivers/expiration";
import { createLegacySmartwaiverCheckIns } from "./legacy-check-in-service";
import { createOpenPlayVisit } from "./visit-service";
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
  smartwaiver_legacy_waivers:
    | { activated: boolean; expires_on: string; signed_at: string | null; signed_on_ymd: string | null }
    | Array<{ activated: boolean; expires_on: string; signed_at: string | null; signed_on_ymd: string | null }>
    | null;
};

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export type PublicWaiverMatch = Omit<SelfCheckInSelection, "paymentMethod"> & {
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
  const first = options.input.firstName.toLowerCase();
  const last = options.input.lastName.toLowerCase();
  const [nativeResult, legacyResult] = await Promise.all([
    supabase
      .from("waiver_participants")
      .select("id,first_name,last_name,dob,role,waiver_submissions!inner(status,expires_on,signed_at)")
      .eq("search_first_name", first)
      .eq("search_last_name", last)
      .limit(10),
    supabase
      .from("smartwaiver_legacy_participants")
      .select("id,first_name,last_name,dob,role,smartwaiver_legacy_waivers!inner(activated,expires_on,signed_at,signed_on_ymd)")
      .eq("search_first_name", first)
      .eq("search_last_name", last)
      .limit(10),
  ]);
  if (nativeResult.error) throw new Error("Unable to check waiver records");

  const nativeMatches = ((nativeResult.data ?? []) as NativeRow[]).filter((row) => {
    const waiver = one(row.waiver_submissions);
    return Boolean(
      row.role === "child" &&
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
        row.role === "child" &&
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

  if (selected.source === "native") {
    await createOpenPlayVisit({
      visitDateYmd: options.businessDayYmd,
      staffId: "customer-self-check-in",
      notes: "Customer QR self check-in - admission pending front desk review",
      attendees: [{
        participantId: selected.participantId,
        adultMode: null,
        clientPriceCents: null,
        overridePriceCents: null,
        paymentMethod: options.selection.paymentMethod,
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
        adultMode: null,
        clientPriceCents: null,
        overridePriceCents: null,
        paymentMethod: options.selection.paymentMethod,
      }],
    });
    return { needsWaiver: false };
  }
  return { needsWaiver: true };
}
