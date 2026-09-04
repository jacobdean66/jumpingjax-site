import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isWaiverExpired } from "@/lib/waivers/expiration";
import { getCompletionByToken } from "@/lib/waivers/submit";
import { ageInCompletedYearsOnDate } from "@/lib/open-play/pricing";
import { businessDayYmdFromInstant } from "@/lib/open-play/business-day";
import {
  cleanPartyCheckInText,
  isUuid,
  normalizeGuestDob,
  normalizePartyDate,
  partyCheckInArrivalMessage,
  partyCheckInSigningMessage,
  type FacilityPartyWaiverMatch,
  type FacilityPartyGuest,
  type PublicFacilityParty,
} from "./check-in";

type FacilityBookingLookup = {
  id: string;
  readable_date: string | null;
  readable_time: string | null;
  child_name: string | null;
  party_label: string | null;
  status: string | null;
};

type WaiverParticipantLookup = {
  id: string;
  submission_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  role: "child" | "adult_signer" | "adult_covered";
  waiver_submissions:
    | {
        id: string;
        status: string | null;
        signer_first_name: string;
        signer_last_name: string;
        expires_on: string;
        signed_at?: string;
      }
    | {
        id: string;
        status: string | null;
        signer_first_name: string;
        signer_last_name: string;
        expires_on: string;
        signed_at?: string;
      }[]
    | null;
};

type FacilityPartyGuestRow = {
  id: string;
  waiver_submission_id: string;
  waiver_participant_id: string;
  guest_first_name: string;
  guest_last_name: string;
  guest_dob: string;
  participant_role: string;
  signer_first_name: string;
  signer_last_name: string;
  waiver_expires_on: string;
  checked_in_at: string | null;
  checked_in_by: string | null;
  created_at: string;
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function toGuest(row: FacilityPartyGuestRow): FacilityPartyGuest {
  return {
    id: row.id,
    participantId: row.waiver_participant_id,
    submissionId: row.waiver_submission_id,
    firstName: row.guest_first_name,
    lastName: row.guest_last_name,
    dob: row.guest_dob,
    role: row.participant_role,
    signerName: `${row.signer_first_name} ${row.signer_last_name}`.trim(),
    waiverExpiresOn: row.waiver_expires_on,
    checkedInAt: row.checked_in_at,
    checkedInBy: row.checked_in_by,
    createdAt: row.created_at,
  };
}

async function loadFacilityBooking(bookingId: string) {
  if (!isUuid(bookingId)) return null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_bookings")
    .select("id, readable_date, readable_time, child_name, party_label, status")
    .eq("id", bookingId)
    .maybeSingle<FacilityBookingLookup>();
  if (error) throw new Error(error.message);
  return data;
}

function bookingAcceptsGuests(status: string | null): boolean {
  return ["approved", "confirmed"].includes(
    status?.trim().toLowerCase() ?? "",
  );
}

function publicGuestName(firstName: string, lastName: string): string {
  const first = cleanPartyCheckInText(firstName);
  const initial = cleanPartyCheckInText(lastName).charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

function ageForMatch(dob: string, evaluationAt: Date): number | null {
  try {
    return ageInCompletedYearsOnDate(
      dob,
      businessDayYmdFromInstant(evaluationAt),
    );
  } catch {
    return null;
  }
}

async function loadActiveWaiverParticipantMatches(input: {
  firstName: string;
  lastName: string;
  evaluationAt: Date;
}): Promise<WaiverParticipantLookup[]> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("waiver_participants")
    .select(
      "id, submission_id, first_name, last_name, dob, role, waiver_submissions(id, status, signer_first_name, signer_last_name, expires_on, signed_at)",
    )
    .eq("search_first_name", input.firstName.toLowerCase())
    .eq("search_last_name", input.lastName.toLowerCase())
    .limit(10);
  if (error) throw new Error(error.message);

  const active = ((data ?? []) as WaiverParticipantLookup[])
    .filter((row) => {
      const submission = firstRelated(row.waiver_submissions);
      return (
        submission?.status === "completed" &&
        !isWaiverExpired({
          expiresOnYmd: submission.expires_on,
          evaluationAt: input.evaluationAt,
        })
      );
    })
    .sort((a, b) => {
      const aSigned = firstRelated(a.waiver_submissions)?.signed_at ?? "";
      const bSigned = firstRelated(b.waiver_submissions)?.signed_at ?? "";
      return bSigned.localeCompare(aSigned);
    });

  const unique = new Map<string, WaiverParticipantLookup>();
  for (const row of active) {
    const identity = `${row.first_name.trim().toLowerCase()}|${row.last_name
      .trim()
      .toLowerCase()}|${row.dob}`;
    if (!unique.has(identity)) unique.set(identity, row);
  }
  return [...unique.values()];
}

export async function loadPublicFacilityParty(
  bookingId: string,
): Promise<PublicFacilityParty | null> {
  const booking = await loadFacilityBooking(bookingId);
  if (!booking || !bookingAcceptsGuests(booking.status)) return null;
  const guests = await loadFacilityPartyGuests(booking.id);
  return {
    id: booking.id,
    title: cleanPartyCheckInText(booking.child_name) || "Birthday party",
    partyLabel: cleanPartyCheckInText(booking.party_label) || "Facility party",
    date: cleanPartyCheckInText(booking.readable_date),
    time: cleanPartyCheckInText(booking.readable_time),
    checkedInGuests: guests
      .filter(
        (guest): guest is FacilityPartyGuest & { checkedInAt: string } =>
          Boolean(guest.checkedInAt),
      )
      .map((guest) => ({
        id: guest.id,
        displayName: publicGuestName(guest.firstName, guest.lastName),
        checkedInAt: guest.checkedInAt,
      })),
  };
}

export async function findFacilityPartyWaiverMatches(input: {
  bookingId: string;
  firstName: unknown;
  lastName: unknown;
  evaluationAt?: Date;
}): Promise<
  | { ok: true; matches: FacilityPartyWaiverMatch[] }
  | { ok: false; code: "not_found" | "validation"; message: string }
> {
  const booking = await loadFacilityBooking(
    cleanPartyCheckInText(input.bookingId, 64),
  );
  if (!booking || !bookingAcceptsGuests(booking.status)) {
    return { ok: false, code: "not_found", message: "Party not found." };
  }
  const firstName = cleanPartyCheckInText(input.firstName);
  const lastName = cleanPartyCheckInText(input.lastName);
  if (!firstName || !lastName) {
    return {
      ok: false,
      code: "validation",
      message: "Enter the guest first and last name.",
    };
  }
  const evaluationAt = input.evaluationAt ?? new Date();
  const rows = await loadActiveWaiverParticipantMatches({
    firstName,
    lastName,
    evaluationAt,
  });
  return {
    ok: true,
    matches: rows.map((row) => ({
      participantId: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      ageYears: ageForMatch(row.dob, evaluationAt),
    })),
  };
}

export async function checkInFacilityPartyWaiverMatch(input: {
  bookingId: string;
  participantId: unknown;
  firstName: unknown;
  lastName: unknown;
  partyDate?: unknown;
  evaluationAt?: Date;
}) {
  const bookingId = cleanPartyCheckInText(input.bookingId, 64);
  const participantId = cleanPartyCheckInText(input.participantId, 64);
  const firstName = cleanPartyCheckInText(input.firstName);
  const lastName = cleanPartyCheckInText(input.lastName);
  if (!isUuid(participantId)) {
    return {
      ok: false as const,
      code: "validation",
      message: "Choose your name from the waiver results.",
    };
  }
  const booking = await loadFacilityBooking(bookingId);
  if (!booking || !bookingAcceptsGuests(booking.status)) {
    return { ok: false as const, code: "not_found", message: "Party not found." };
  }
  const rows = await loadActiveWaiverParticipantMatches({
    firstName,
    lastName,
    evaluationAt: input.evaluationAt ?? new Date(),
  });
  const participant = rows.find((row) => row.id === participantId);
  if (!participant) {
    return {
      ok: false as const,
      code: "not_found",
      message: "That current waiver is no longer available.",
    };
  }
  let guest = await upsertPartyGuest({ bookingId, participant });
  if (!guest.checkedInAt) {
    const present = await setFacilityPartyGuestPresent({
      bookingId,
      guestId: guest.id,
      present: true,
      staffLabel: "Customer QR",
    });
    if (present.ok) guest = present.guest;
  }
  const partyDate = normalizePartyDate(input.partyDate) ?? booking.readable_date;
  return {
    ok: true as const,
    guest,
    partyDate,
    message: partyCheckInArrivalMessage(partyDate),
  };
}

async function upsertPartyGuest(input: {
  bookingId: string;
  participant: WaiverParticipantLookup;
}) {
  const submission = firstRelated(input.participant.waiver_submissions);
  if (!submission || submission.status !== "completed") {
    throw new Error("Completed waiver not found");
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_party_guests")
    .upsert(
      {
        booking_id: input.bookingId,
        waiver_submission_id: input.participant.submission_id,
        waiver_participant_id: input.participant.id,
        guest_first_name: input.participant.first_name,
        guest_last_name: input.participant.last_name,
        guest_dob: input.participant.dob,
        participant_role: input.participant.role,
        signer_first_name: submission.signer_first_name,
        signer_last_name: submission.signer_last_name,
        waiver_expires_on: submission.expires_on,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "booking_id,waiver_participant_id" },
    )
    .select(
      "id, waiver_submission_id, waiver_participant_id, guest_first_name, guest_last_name, guest_dob, participant_role, signer_first_name, signer_last_name, waiver_expires_on, checked_in_at, checked_in_by, created_at",
    )
    .single<FacilityPartyGuestRow>();
  if (error) throw new Error(error.message);
  return toGuest(data);
}

export async function findAndAddFacilityPartyGuest(input: {
  bookingId: string;
  firstName: unknown;
  lastName: unknown;
  dob: unknown;
  partyDate?: unknown;
  evaluationAt?: Date;
}) {
  const bookingId = cleanPartyCheckInText(input.bookingId, 64);
  const booking = await loadFacilityBooking(bookingId);
  if (!booking) {
    return { ok: false as const, code: "not_found", message: "Party not found." };
  }

  const firstName = cleanPartyCheckInText(input.firstName);
  const lastName = cleanPartyCheckInText(input.lastName);
  const dob = normalizeGuestDob(input.dob);
  const partyDate = normalizePartyDate(input.partyDate) ?? booking.readable_date;
  if (!firstName || !lastName || !dob) {
    return {
      ok: false as const,
      code: "validation",
      message: "Enter the guest first name, last name, and date of birth.",
    };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("waiver_participants")
    .select(
      "id, submission_id, first_name, last_name, dob, role, waiver_submissions(id, status, signer_first_name, signer_last_name, expires_on)",
    )
    .eq("search_first_name", firstName.toLowerCase())
    .eq("search_last_name", lastName.toLowerCase())
    .eq("dob", dob)
    .limit(5);
  if (error) throw new Error(error.message);

  const activeMatch = ((data ?? []) as WaiverParticipantLookup[]).find((row) => {
    const submission = firstRelated(row.waiver_submissions);
    return (
      submission?.status === "completed" &&
      !isWaiverExpired({
        expiresOnYmd: submission.expires_on,
        evaluationAt: input.evaluationAt ?? new Date(),
      })
    );
  });

  if (!activeMatch) {
    return {
      ok: true as const,
      found: false as const,
      partyDate,
      message: partyCheckInSigningMessage(partyDate),
    };
  }

  const guest = await upsertPartyGuest({ bookingId, participant: activeMatch });
  return {
    ok: true as const,
    found: true as const,
    partyDate,
    guest,
    message: partyCheckInArrivalMessage(partyDate),
  };
}

export async function addFacilityPartySubmissionGuests(input: {
  bookingId: string;
  publicToken: string;
  partyDate?: unknown;
  markPresent?: boolean;
}) {
  const bookingId = cleanPartyCheckInText(input.bookingId, 64);
  const booking = await loadFacilityBooking(bookingId);
  if (!booking) {
    return { ok: false as const, code: "not_found", message: "Party not found." };
  }

  const completion = await getCompletionByToken({ token: input.publicToken });
  if (!completion) {
    return { ok: false as const, code: "not_found", message: "Waiver not found." };
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("waiver_participants")
    .select(
      "id, submission_id, first_name, last_name, dob, role, waiver_submissions(id, status, signer_first_name, signer_last_name, expires_on)",
    )
    .eq("submission_id", completion.submissionId);
  if (error) throw new Error(error.message);

  const guests: FacilityPartyGuest[] = [];
  for (const participant of (data ?? []) as WaiverParticipantLookup[]) {
    let guest = await upsertPartyGuest({ bookingId, participant });
    if (input.markPresent && !guest.checkedInAt) {
      const present = await setFacilityPartyGuestPresent({
        bookingId,
        guestId: guest.id,
        present: true,
        staffLabel: "Customer kiosk",
      });
      if (present.ok) guest = present.guest;
    }
    guests.push(guest);
  }

  const partyDate = normalizePartyDate(input.partyDate) ?? booking.readable_date;
  return {
    ok: true as const,
    partyDate,
    guests,
    message: partyCheckInArrivalMessage(partyDate),
  };
}

export async function loadFacilityPartyGuests(bookingId: string) {
  if (!isUuid(bookingId)) return [];
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_party_guests")
    .select(
      "id, waiver_submission_id, waiver_participant_id, guest_first_name, guest_last_name, guest_dob, participant_role, signer_first_name, signer_last_name, waiver_expires_on, checked_in_at, checked_in_by, created_at",
    )
    .eq("booking_id", bookingId)
    .order("guest_last_name", { ascending: true })
    .order("guest_first_name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FacilityPartyGuestRow[]).map(toGuest);
}

export async function setFacilityPartyGuestPresent(input: {
  bookingId: string;
  guestId: string;
  present: boolean;
  staffLabel: string | null;
}) {
  if (!isUuid(input.bookingId) || !isUuid(input.guestId)) {
    return { ok: false as const, code: "validation", message: "Invalid guest." };
  }
  const now = input.present ? new Date().toISOString() : null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("facility_party_guests")
    .update({
      checked_in_at: now,
      checked_in_by: input.present ? input.staffLabel || "Staff" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("booking_id", input.bookingId)
    .eq("id", input.guestId)
    .select(
      "id, waiver_submission_id, waiver_participant_id, guest_first_name, guest_last_name, guest_dob, participant_role, signer_first_name, signer_last_name, waiver_expires_on, checked_in_at, checked_in_by, created_at",
    )
    .maybeSingle<FacilityPartyGuestRow>();
  if (error) throw new Error(error.message);
  if (!data) return { ok: false as const, code: "not_found", message: "Guest not found." };
  return { ok: true as const, guest: toGuest(data) };
}
