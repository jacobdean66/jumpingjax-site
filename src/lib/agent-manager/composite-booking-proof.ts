import {
  evaluateCompositeBooking,
  type CompositeBookingEvaluation,
} from "./composite-booking-evaluation";
import type { CompositeBookingRequest } from "./composite-booking";

type ProofStatus = CompositeBookingEvaluation["status"];

export type CompositeBookingProofScenario = {
  name: "rental" | "facility" | "foam" | "combined" | "conflict" | "correction" | "cancellation";
  status: ProofStatus;
  projectionCount: number;
  quoteTotalCents: number;
  approvalIntentCreated: boolean;
  writesAllowed: false;
};

export type CompositeBookingProofResult = {
  scenarios: CompositeBookingProofScenario[];
  ready: number;
  safelyBlocked: number;
  aiInvocations: 0;
  productionWrites: 0;
};

const rental = {
  kind: "rental" as const,
  date: "2026-10-03",
  startMinutes: 720,
  durationMinutes: 240,
  itemRefs: ["18-ft-basic-waterslide"],
  locationRef: "proof-location",
  distanceMiles: 12,
};

const facility = {
  kind: "facility_party" as const,
  date: "2026-10-03",
  startMinutes: 780,
  durationMinutes: 120,
  packageRef: "whole-facility",
};

const foam = {
  kind: "foam_party" as const,
  date: "2026-10-03",
  startMinutes: 840,
  durationMinutes: 60,
  locationRef: "proof-location",
  distanceMiles: 12,
};

function request(revision: number, services: CompositeBookingRequest["services"]): CompositeBookingRequest {
  return { conversationRef: "deterministic-proof", revision, services };
}

function evidence(
  name: CompositeBookingProofScenario["name"],
  result: CompositeBookingEvaluation,
): CompositeBookingProofScenario {
  return {
    name,
    status: result.status,
    projectionCount: result.plan.projections.length,
    quoteTotalCents: result.quote.totalCents,
    approvalIntentCreated: result.approvalIntent !== null,
    writesAllowed: false,
  };
}

export function runCompositeBookingProof(): CompositeBookingProofResult {
  const combined = request(4, [rental, facility, foam]);
  const scenarios: CompositeBookingProofScenario[] = [
    evidence("rental", evaluateCompositeBooking(request(1, [rental]))),
    evidence("facility", evaluateCompositeBooking(request(2, [facility]))),
    evidence("foam", evaluateCompositeBooking(request(3, [foam]))),
    evidence("combined", evaluateCompositeBooking(combined)),
    evidence("conflict", evaluateCompositeBooking(combined, [{
      resourceRef: "facility:main",
      date: facility.date,
      startMinutes: 800,
      endMinutes: 900,
    }])),
    evidence("correction", evaluateCompositeBooking(request(5, [
      rental,
      facility,
      { ...foam, startMinutes: 900, durationMinutes: 120 },
    ]))),
    evidence("cancellation", evaluateCompositeBooking({ ...combined, revision: 6, cancelled: true })),
  ];
  return {
    scenarios,
    ready: scenarios.filter(({ status }) => status === "ready_for_approval").length,
    safelyBlocked: scenarios.filter(({ status }) => status !== "ready_for_approval").length,
    aiInvocations: 0,
    productionWrites: 0,
  };
}
