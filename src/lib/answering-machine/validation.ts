import type {
  AnsweringMachineBookingDetails,
  AnsweringMachineReviewInput,
  AnsweringMachineServiceKind,
} from "./types";

function boundedText(value: unknown, max: number) {
  return typeof value === "string" && value.length <= max ? value : null;
}

function nullableDate(value: unknown) {
  if (value === null || value === "") return null;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function nullableTime(value: unknown) {
  if (value === null || value === "") return null;
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}

export const EMPTY_ANSWERING_MACHINE_BOOKING_DETAILS: AnsweringMachineBookingDetails = {
  customerName: "", customerEmail: "", customerPhone: "", eventStartTime: "",
  duration: "4 Hours", requestedDeliveryWindow: "", eventAddress: "", distanceMiles: null,
  setupSurface: "", setupAccess: "", setupNotes: "", paymentMethod: "Card",
  facilityPartyKind: "private", facilityRoom: "room-20", facilityDurationMinutes: 120,
  childName: "", childGender: "", childAge: "", partyTheme: "", drinkChoice: "",
};

function parseBookingDetails(value: unknown): AnsweringMachineBookingDetails | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const text = (key: keyof AnsweringMachineBookingDetails, max: number) => boundedText(input[key], max);
  const customerName = text("customerName", 120);
  const customerEmail = text("customerEmail", 254);
  const customerPhone = text("customerPhone", 40);
  const eventStartTime = text("eventStartTime", 5);
  const duration = text("duration", 80);
  const requestedDeliveryWindow = text("requestedDeliveryWindow", 100);
  const eventAddress = text("eventAddress", 500);
  const setupSurface = text("setupSurface", 120);
  const setupAccess = text("setupAccess", 500);
  const setupNotes = text("setupNotes", 2000);
  const paymentMethod = text("paymentMethod", 80);
  const childName = text("childName", 120);
  const childGender = text("childGender", 80);
  const childAge = text("childAge", 40);
  const partyTheme = text("partyTheme", 200);
  const drinkChoice = text("drinkChoice", 120);
  if ([customerName, customerEmail, customerPhone, eventStartTime, duration,
    requestedDeliveryWindow, eventAddress, setupSurface, setupAccess, setupNotes,
    paymentMethod, childName, childGender, childAge, partyTheme, drinkChoice].some((item) => item === null)) return null;
  const distanceMiles = input.distanceMiles === null || input.distanceMiles === "" ? null
    : typeof input.distanceMiles === "number" && Number.isFinite(input.distanceMiles)
      && input.distanceMiles >= 0 && input.distanceMiles <= 500 ? input.distanceMiles : undefined;
  const facilityPartyKind = input.facilityPartyKind === "public" || input.facilityPartyKind === "private"
    ? input.facilityPartyKind : undefined;
  const facilityRoom = input.facilityRoom === "room-10" || input.facilityRoom === "room-20"
    ? input.facilityRoom : undefined;
  const facilityDurationMinutes = input.facilityDurationMinutes === 90
    || input.facilityDurationMinutes === 120 || input.facilityDurationMinutes === 180
    ? input.facilityDurationMinutes : undefined;
  if (distanceMiles === undefined || !facilityPartyKind || !facilityRoom || !facilityDurationMinutes) return null;
  return {
    customerName: customerName!, customerEmail: customerEmail!, customerPhone: customerPhone!,
    eventStartTime: eventStartTime!, duration: duration!, requestedDeliveryWindow: requestedDeliveryWindow!,
    eventAddress: eventAddress!, distanceMiles, setupSurface: setupSurface!, setupAccess: setupAccess!,
    setupNotes: setupNotes!, paymentMethod: paymentMethod!, facilityPartyKind, facilityRoom,
    facilityDurationMinutes, childName: childName!, childGender: childGender!, childAge: childAge!,
    partyTheme: partyTheme!, drinkChoice: drinkChoice!,
  };
}

export function parseAnsweringMachineReview(value: unknown): AnsweringMachineReviewInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const patch = input.patch;
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) return null;
  if (input.action !== "save" && input.action !== "book" && input.action !== "reject") return null;
  if (!Number.isInteger(input.expectedRevision) || (input.expectedRevision as number) < 1) return null;
  if (!patch || typeof patch !== "object") return null;
  const raw = patch as Record<string, unknown>;
  const serviceKind = raw.serviceKind === null || raw.serviceKind === ""
    ? null
    : raw.serviceKind === "rental" || raw.serviceKind === "facility_party"
      ? raw.serviceKind as AnsweringMachineServiceKind
      : undefined;
  const eventDate = nullableDate(raw.eventDate);
  const facilityStartTime = nullableTime(raw.facilityStartTime);
  const transcript = boundedText(raw.transcript, 50000);
  const agentSummary = boundedText(raw.agentSummary, 2000);
  const ownerNotes = boundedText(raw.ownerNotes, 2000);
  const bookingDetails = parseBookingDetails(raw.bookingDetails);
  if (serviceKind === undefined || eventDate === undefined || facilityStartTime === undefined
    || transcript === null || agentSummary === null || ownerNotes === null || !bookingDetails) return null;
  if (!Array.isArray(raw.rentalItems) || raw.rentalItems.length > 20) return null;
  const rentalItems = raw.rentalItems.map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
  if (rentalItems.some((item) => item.length > 120)) return null;

  return {
    id: input.id,
    action: input.action,
    expectedRevision: input.expectedRevision as number,
    patch: {
      serviceKind, eventDate, facilityStartTime, rentalItems, transcript,
      transcriptComplete: raw.transcriptComplete === true,
      agentSummary, ownerNotes, bookingDetails,
    },
  };
}

export type AnsweringMachineVoicemailIngest = {
  providerCallId: string;
  sourceEventId: string;
  callerRef: string;
  callerDisplayName: string | null;
  mediaId: string;
  mimeType: string;
  sha256: string | null;
};

export type AnsweringMachineIngest = {
  providerCallId: string;
  sourceEventId: string;
  callerRef: string;
  callerDisplayName: string | null;
  status: "received" | "in_progress" | "processing" | "needs_review" | "failed";
  transcript: string;
  transcriptComplete: boolean;
  serviceKind: AnsweringMachineServiceKind | null;
  eventDate: string | null;
  facilityStartTime: string | null;
  rentalItems: string[];
  agentSummary: string;
};

export function parseAnsweringMachineIngest(value: unknown): AnsweringMachineIngest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const providerCallId = boundedText(input.providerCallId, 240);
  const sourceEventId = boundedText(input.sourceEventId, 300);
  const callerRef = boundedText(input.callerRef, 240);
  const callerDisplayName = input.callerDisplayName === null || input.callerDisplayName === undefined
    ? null : boundedText(input.callerDisplayName, 160);
  const statuses = ["received", "in_progress", "processing", "needs_review", "failed"];
  const serviceKind = input.serviceKind === null || input.serviceKind === undefined
    ? null : input.serviceKind === "rental" || input.serviceKind === "facility_party"
      ? input.serviceKind as AnsweringMachineServiceKind : undefined;
  const eventDate = nullableDate(input.eventDate ?? null);
  const facilityStartTime = nullableTime(input.facilityStartTime ?? null);
  const transcript = boundedText(input.transcript ?? "", 50000);
  const agentSummary = boundedText(input.agentSummary ?? "", 2000);
  if (!providerCallId || !sourceEventId || !callerRef || callerDisplayName === null && input.callerDisplayName != null
    || typeof input.status !== "string" || !statuses.includes(input.status) || serviceKind === undefined
    || eventDate === undefined || facilityStartTime === undefined || transcript === null || agentSummary === null) return null;
  const rawItems = input.rentalItems ?? [];
  if (!Array.isArray(rawItems) || rawItems.length > 20) return null;
  const rentalItems = rawItems.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
  if (rentalItems.some((item) => item.length > 120)) return null;
  return {
    providerCallId, sourceEventId, callerRef, callerDisplayName,
    status: input.status as AnsweringMachineIngest["status"], transcript,
    transcriptComplete: input.transcriptComplete === true, serviceKind, eventDate,
    facilityStartTime, rentalItems, agentSummary,
  };
}
