import type { NormalizedCallEvent, TelephonyProvider } from "./contracts";

export function normalizedFixture(provider: TelephonyProvider): NormalizedCallEvent {
  return {
    provider,
    eventId: `${provider}-event-1`,
    eventType: "call.started",
    callId: `${provider}-call-1`,
    occurredAtIso: "2026-08-11T12:00:00.000Z",
    payload: { simulation: true },
  };
}
