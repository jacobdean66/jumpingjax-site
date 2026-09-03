import {
  advanceBookingConversation,
  createBookingConversation,
  type BookingConversationState,
  type BookingConversationTurn,
} from "@/lib/agent-manager/booking-conversation";

export type AnsweringMachineTestScenario = "facility" | "rental" | "all_three";

export type AnsweringMachineTestCallResult = {
  scenario: AnsweringMachineTestScenario;
  title: string;
  transcript: string[];
  status: "ready_for_approval" | "blocked";
  quoteTotalCents: number;
  projections: Array<{ service: string; date: string; startMinutes: number; endMinutes: number }>;
  productionWrites: 0;
  customerMessages: 0;
  aiInvocations: 0;
};

type Script = {
  title: string;
  turns: Array<{ answer: string; turn: BookingConversationTurn }>;
};

const scripts: Record<AnsweringMachineTestScenario, Script> = {
  facility: {
    title: "Facility party",
    turns: [
      { answer: "A facility party.", turn: { type: "select_services", services: ["facility_party"] } },
      { answer: "February 14, 2027.", turn: { type: "set_schedule", service: "facility_party", date: "2027-02-14", startMinutes: 840, durationMinutes: 120 } },
      { answer: "The whole facility for two hours.", turn: { type: "set_facility_package", packageRef: "whole-facility-2h" } },
    ],
  },
  rental: {
    title: "Rental delivery",
    turns: [
      { answer: "A waterslide rental.", turn: { type: "select_services", services: ["rental"] } },
      { answer: "February 15, 2027.", turn: { type: "set_schedule", service: "rental", date: "2027-02-15", startMinutes: 720, durationMinutes: 240 } },
      { answer: "The 18-foot basic waterslide.", turn: { type: "set_rental_items", itemRefs: ["18-ft-basic-waterslide"] } },
      { answer: "Use the test delivery location.", turn: { type: "set_location", service: "rental", locationRef: "test-delivery-location" } },
      { answer: "Twelve miles.", turn: { type: "set_distance", service: "rental", distanceMiles: 12 } },
    ],
  },
  all_three: {
    title: "Rental, facility party, and foam party",
    turns: [
      { answer: "All three services.", turn: { type: "select_services", services: ["rental", "facility_party", "foam_party"] } },
      { answer: "February 20, 2027 at noon.", turn: { type: "set_schedule", service: "rental", date: "2027-02-20", startMinutes: 720, durationMinutes: 240 } },
      { answer: "The 18-foot basic waterslide.", turn: { type: "set_rental_items", itemRefs: ["18-ft-basic-waterslide"] } },
      { answer: "Use the test delivery location.", turn: { type: "set_location", service: "rental", locationRef: "test-delivery-location" } },
      { answer: "Twelve miles.", turn: { type: "set_distance", service: "rental", distanceMiles: 12 } },
      { answer: "February 21, 2027 at 2 PM.", turn: { type: "set_schedule", service: "facility_party", date: "2027-02-21", startMinutes: 840, durationMinutes: 120 } },
      { answer: "The whole facility for two hours.", turn: { type: "set_facility_package", packageRef: "whole-facility-2h" } },
      { answer: "February 22, 2027 at 3 PM for one hour.", turn: { type: "set_schedule", service: "foam_party", date: "2027-02-22", startMinutes: 900, durationMinutes: 60 } },
      { answer: "Use the test delivery location.", turn: { type: "set_location", service: "foam_party", locationRef: "test-delivery-location" } },
      { answer: "Twelve miles.", turn: { type: "set_distance", service: "foam_party", distanceMiles: 12 } },
    ],
  },
};

export function runAnsweringMachineTestCall(scenario: AnsweringMachineTestScenario): AnsweringMachineTestCallResult {
  const script = scripts[scenario];
  let state: BookingConversationState = createBookingConversation(`answering-machine-test-${scenario}`);
  const transcript = ["Agent: Thanks for calling Jumping Jax. What would you like to book?"];
  let result: ReturnType<typeof advanceBookingConversation> | null = null;

  for (const step of script.turns) {
    transcript.push(`Caller: ${step.answer}`);
    result = advanceBookingConversation(state, step.turn);
    state = result.state;
    if (result.nextPrompt) transcript.push(`Agent: ${result.nextPrompt.text}`);
  }

  if (!result) throw new Error("The test call script has no turns.");
  const ready = result.evaluation.status === "ready_for_approval" && result.evaluation.approvalIntent !== null;

  return {
    scenario,
    title: script.title,
    transcript,
    status: ready ? "ready_for_approval" : "blocked",
    quoteTotalCents: result.evaluation.quote.totalCents,
    projections: result.plan.projections.map(({ service, date, startMinutes, endMinutes }) => ({
      service,
      date,
      startMinutes,
      endMinutes,
    })),
    productionWrites: 0,
    customerMessages: 0,
    aiInvocations: 0,
  };
}
