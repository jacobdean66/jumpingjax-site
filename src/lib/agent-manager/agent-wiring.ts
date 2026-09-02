export type AgentConnectionState =
  | "connected"
  | "staged"
  | "read_only"
  | "setup_required"
  | "not_connected";

export type AgentWiring = {
  key: string;
  state: AgentConnectionState;
  handler: string;
  trigger: string;
  summary: string;
  supervisorDispatch: boolean;
  canPause: boolean;
};

export function buildAgentWiring(input: {
  nominationReady: boolean;
}): AgentWiring[] {
  return [
    {
      key: "supervisor",
      state: "connected",
      handler: "Deterministic website supervisor",
      trigger: "Owner chat + five-minute watcher",
      summary: "Checks website and operational health; exact safe controls only.",
      supervisorDispatch: true,
      canPause: false,
    },
    {
      key: "booking",
      state: "read_only",
      handler: "Booking triage and composite-intent planner",
      trigger: "Owner scan + staged approval workflow",
      summary: "Reads and stages reviews; live booking, calendar, payment, and customer writes remain off.",
      supervisorDispatch: true,
      canPause: true,
    },
    {
      key: "waiver",
      state: "read_only",
      handler: "Waiver metadata triage",
      trigger: "Owner scan",
      summary: "Checks waiver evidence metadata without reading signer or participant content.",
      supervisorDispatch: true,
      canPause: true,
    },
    {
      key: "nomination",
      state: input.nominationReady ? "connected" : "setup_required",
      handler: "Resend inbound to Trigger.dev",
      trigger: input.nominationReady ? "Signed inbound email event" : "Fixture proof only; production inbound disabled",
      summary: input.nominationReady
        ? "Structured nominations enter the existing giveaway store with zero normal AI calls."
        : "The deterministic proof passed, but production email ingestion is not connected.",
      supervisorDispatch: false,
      canPause: input.nominationReady,
    },
    {
      key: "party-invitation",
      state: "connected",
      handler: "Deterministic invitation theme and renderer",
      trigger: "Invitation builder actions",
      summary: "Runs inside the invitation workflow; it does not create or alter a booking.",
      supervisorDispatch: false,
      canPause: false,
    },
    {
      key: "social",
      state: "staged",
      handler: "Multi-stage Social Posts workflow",
      trigger: "Owner request and checkpoint approvals",
      summary: "Creates owner-review drafts only; publishing and paid generation remain separate actions.",
      supervisorDispatch: true,
      canPause: true,
    },
    {
      key: "coding",
      state: "read_only",
      handler: "Deterministic code-health diagnosis worker",
      trigger: "Owner request + supervisor health watcher",
      summary: "Diagnoses deployed routes, agent failures, and code-security status; fixes and deployments remain approval-gated.",
      supervisorDispatch: true,
      canPause: true,
    },
    {
      key: "health-security",
      state: "read_only",
      handler: "Security Control Center",
      trigger: "Dashboard and supervisor health checks",
      summary: "Reads Aikido and AITHURA status; repairs and deployment require review.",
      supervisorDispatch: true,
      canPause: false,
    },
  ];
}
