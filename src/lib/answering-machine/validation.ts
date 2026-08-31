import type { AnsweringMachineReviewInput, AnsweringMachineServiceKind } from "./types";

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

export function parseAnsweringMachineReview(value: unknown): AnsweringMachineReviewInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const patch = input.patch;
  if (typeof input.id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.id)) return null;
  if (input.action !== "save" && input.action !== "approve" && input.action !== "reject") return null;
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
  if (serviceKind === undefined || eventDate === undefined || facilityStartTime === undefined
    || transcript === null || agentSummary === null || ownerNotes === null) return null;
  if (!Array.isArray(raw.rentalItems) || raw.rentalItems.length > 20) return null;
  const rentalItems = raw.rentalItems.map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
  if (rentalItems.some((item) => item.length > 120)) return null;

  return {
    id: input.id,
    action: input.action,
    expectedRevision: input.expectedRevision as number,
    patch: { serviceKind, eventDate, facilityStartTime, rentalItems, transcript, agentSummary, ownerNotes },
  };
}

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
