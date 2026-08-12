import { randomUUID } from "node:crypto";

import { redactPayload } from "./security";
import type { AuditEvent, AuditEventType } from "./types";

export interface AuditLog {
  append(
    sessionId: string | null,
    eventType: AuditEventType,
    payload?: Record<string, unknown>,
  ): AuditEvent;
  list(sessionId?: string | null): AuditEvent[];
}

export class InMemoryAuditLog implements AuditLog {
  private readonly events: AuditEvent[] = [];

  append(
    sessionId: string | null,
    eventType: AuditEventType,
    payload: Record<string, unknown> = {},
  ): AuditEvent {
    const event: AuditEvent = {
      id: randomUUID(),
      sessionId,
      eventType,
      payload: redactPayload(payload),
      createdAtIso: new Date().toISOString(),
    };
    this.events.push(event);
    return event;
  }

  list(sessionId?: string | null): AuditEvent[] {
    if (sessionId === undefined) return [...this.events];
    return this.events.filter((event) => event.sessionId === sessionId);
  }
}
