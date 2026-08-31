import {
  buildCompositeBookingDryRun,
  type CalendarBlock,
  type CompositeBookingPlan,
  type CompositeBookingRequest,
  type CompositeServiceKind,
  type CompositeServiceRequest,
} from "./composite-booking";
import {
  evaluateCompositeBooking,
  type CompositeBookingEvaluation,
} from "./composite-booking-evaluation";

export type BookingConversationState = CompositeBookingRequest;

export type BookingConversationTurn =
  | { type: "select_services"; services: CompositeServiceKind[] }
  | {
      type: "set_schedule";
      service: CompositeServiceKind;
      date: string;
      startMinutes: number;
      durationMinutes: number;
    }
  | { type: "set_rental_items"; itemRefs: string[] }
  | { type: "set_facility_package"; packageRef: string }
  | { type: "set_location"; service: "rental" | "foam_party"; locationRef: string }
  | { type: "set_distance"; service: "rental" | "foam_party"; distanceMiles: number }
  | { type: "remove_service"; service: CompositeServiceKind }
  | { type: "cancel" };

export type BookingConversationPrompt = {
  key:
    | "select_services"
    | "date"
    | "start_time"
    | "duration"
    | "rental_items"
    | "facility_package"
    | "location"
    | "distance"
    | "resolve_conflict"
    | "pricing_review"
    | "owner_approval";
  service?: CompositeServiceKind;
  text: string;
};

export type BookingConversationResult = {
  state: BookingConversationState;
  plan: CompositeBookingPlan;
  evaluation: CompositeBookingEvaluation;
  nextPrompt: BookingConversationPrompt | null;
};

const orderedKinds: CompositeServiceKind[] = ["rental", "facility_party", "foam_party"];

export function createBookingConversation(conversationRef: string): BookingConversationState {
  return { conversationRef, revision: 0, services: [] };
}

function updateService(
  services: CompositeServiceRequest[],
  kind: CompositeServiceKind,
  update: Partial<CompositeServiceRequest>,
) {
  return services.map((service) => service.kind === kind ? { ...service, ...update, kind } : service);
}

function applyTurn(state: BookingConversationState, turn: BookingConversationTurn) {
  if (turn.type === "cancel") return { ...state, cancelled: true };
  if (turn.type === "select_services") {
    const uniqueKinds = orderedKinds.filter((kind) => turn.services.includes(kind));
    return {
      ...state,
      cancelled: false,
      services: uniqueKinds.map((kind) => state.services.find((service) => service.kind === kind) ?? { kind }),
    };
  }
  if (turn.type === "remove_service") {
    return { ...state, services: state.services.filter((service) => service.kind !== turn.service) };
  }
  if (turn.type === "set_schedule") {
    return {
      ...state,
      services: updateService(state.services, turn.service, {
        date: turn.date,
        startMinutes: turn.startMinutes,
        durationMinutes: turn.durationMinutes,
      }),
    };
  }
  if (turn.type === "set_rental_items") {
    return { ...state, services: updateService(state.services, "rental", { itemRefs: [...turn.itemRefs] }) };
  }
  if (turn.type === "set_facility_package") {
    return { ...state, services: updateService(state.services, "facility_party", { packageRef: turn.packageRef }) };
  }
  if (turn.type === "set_distance") {
    return { ...state, services: updateService(state.services, turn.service, { distanceMiles: turn.distanceMiles }) };
  }
  return { ...state, services: updateService(state.services, turn.service, { locationRef: turn.locationRef }) };
}

function promptForMissing(field: string): BookingConversationPrompt {
  const match = /^services\.\d+\.(rental|facility_party|foam_party)\.(.+)$/.exec(field);
  if (!match) return { key: "select_services", text: "Which services would you like to book?" };
  const service = match[1] as CompositeServiceKind;
  const name = service.replace("_", " ");
  const prompts: Record<string, BookingConversationPrompt> = {
    date: { key: "date", service, text: `What date would you like for the ${name}?` },
    startMinutes: { key: "start_time", service, text: `What start time would you like for the ${name}?` },
    durationMinutes: { key: "duration", service, text: `How long should the ${name} last?` },
    itemRefs: { key: "rental_items", service, text: "Which rental items would you like?" },
    packageRef: { key: "facility_package", service, text: "Which facility party package would you like?" },
    locationRef: { key: "location", service, text: `What is the event location for the ${name}?` },
    distanceMiles: { key: "distance", service, text: `What is the delivery distance for the ${name}?` },
  };
  return prompts[match[2]] ?? { key: "select_services", text: "Which services would you like to book?" };
}

export function nextBookingConversationPrompt(plan: CompositeBookingPlan): BookingConversationPrompt | null {
  if (plan.status === "cancelled") return null;
  if (plan.status === "needs_information") return promptForMissing(plan.missing[0]);
  if (plan.status === "conflict") {
    return { key: "resolve_conflict", text: "That time is unavailable. Would you like to choose another time?" };
  }
  return {
    key: "owner_approval",
    text: "Your request is ready for Jumping Jax to review. Nothing has been booked or charged yet.",
  };
}

export function advanceBookingConversation(
  state: BookingConversationState,
  turn: BookingConversationTurn,
  existingBlocks: CalendarBlock[] = [],
): BookingConversationResult {
  const updated = applyTurn(state, turn);
  const nextState = { ...updated, revision: state.revision + 1 };
  const plan = buildCompositeBookingDryRun(nextState, existingBlocks);
  const evaluation = evaluateCompositeBooking(nextState, existingBlocks);
  const nextPrompt = evaluation.status === "needs_pricing"
    ? {
        key: "pricing_review" as const,
        text: "That selection needs Jumping Jax pricing review before it can be requested.",
      }
    : nextBookingConversationPrompt(plan);
  return { state: nextState, plan, evaluation, nextPrompt };
}
