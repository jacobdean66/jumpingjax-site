export type SpecialistReadiness = {
  agentKey: "booking";
  displayName: "Booking Agent";
  status: "FRAMEWORK READY";
  activation: "NOT ACTIVATED";
  firstJobType: "booking.workflow.triage";
  handler: "Deterministic TypeScript";
  aiCalls: 0;
  wakeMode: "Event-driven only";
  readsFrom: readonly string[];
  firstCheckpoint: readonly string[];
  blockedActions: readonly string[];
};

const BOOKING_AGENT_READINESS: SpecialistReadiness = {
  agentKey: "booking",
  displayName: "Booking Agent",
  status: "FRAMEWORK READY",
  activation: "NOT ACTIVATED",
  firstJobType: "booking.workflow.triage",
  handler: "Deterministic TypeScript",
  aiCalls: 0,
  wakeMode: "Event-driven only",
  readsFrom: [
    "Existing booking_integration_workflows state",
    "Existing durable booking operation outcomes",
  ],
  firstCheckpoint: [
    "Classify failed or incomplete workflow steps without customer content",
    "Create a redacted owner-facing triage summary",
    "Deduplicate by booking kind, booking ID, and workflow step",
  ],
  blockedActions: [
    "Confirm, reject, edit, or cancel a booking",
    "Send customer or owner messages",
    "Write calendar, payment, or booking records",
    "Enable production, credentials, migrations, or paid services",
  ],
};

export function getNextSpecialistReadiness(): SpecialistReadiness {
  return BOOKING_AGENT_READINESS;
}
