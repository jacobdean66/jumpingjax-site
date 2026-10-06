export type CalendarRemovalResult = "removed" | "retry" | "access_required";

type CalendarApi = {
  events: { delete: (input: { calendarId: string; eventId: string }, options: { timeout: number; retry: false }) => Promise<unknown> };
  calendars: { get: (input: { calendarId: string }, options: { timeout: number; retry: false }) => Promise<unknown> };
};

function statusOf(error: unknown): number {
  const value = error as { code?: unknown; response?: { status?: unknown } } | null;
  return Number(value?.response?.status ?? value?.code);
}

/** A 404 is ambiguous until calendar access has been verified. */
export async function removeCalendarEvent(
  api: CalendarApi,
  calendarId: string,
  eventId: string,
): Promise<CalendarRemovalResult> {
  try {
    await api.events.delete({ calendarId, eventId }, { timeout: 10_000, retry: false });
    return "removed";
  } catch (error) {
    const status = statusOf(error);
    if (status === 410) return "removed";
    if (status === 404) {
      try {
        await api.calendars.get({ calendarId }, { timeout: 10_000, retry: false });
        return "removed";
      } catch (accessError) {
        const accessStatus = statusOf(accessError);
        return [401, 403, 404].includes(accessStatus) ? "access_required" : "retry";
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    if (status === 401 || /invalid_grant|Missing GOOGLE_/i.test(message)) return "access_required";
    // A 403 may be either a quota error or a permissions error.
    if (status === 403 && !/rateLimit|quota|limit exceeded/i.test(message)) return "access_required";
    return "retry";
  }
}

export function removalRetryDelay(attempt: number): number {
  return Math.min(3600, 30 * 2 ** Math.min(Math.max(attempt - 1, 0), 7));
}
