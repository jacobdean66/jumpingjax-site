import { google } from "googleapis";
import { createHash } from "node:crypto";

/**
 * Server-only Google Calendar client (OAuth refresh token).
 * Do not import from client components.
 */
export function createCalendarClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN",
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  return google.calendar({ version: "v3", auth });
}

const ROOM_ID_PATTERN = /^room-\d+$/i;

function formatRoomForSummary(room: string): string {
  const match = /^room-(\d+)$/i.exec(room.trim());
  return match ? match[1] : room.trim();
}

function extractRoom(title: string, description: string): string | null {
  const fromDescription = description.match(/Room:\s*(room-\d+)/i)?.[1];
  if (fromDescription) {
    return fromDescription;
  }

  const parts = title.split(" - ").map((part) => part.trim());
  const roomPart = parts.find(
    (part, index) =>
      index > 0 && index < parts.length - 1 && ROOM_ID_PATTERN.test(part),
  );
  return roomPart ?? null;
}

function parseTitleParts(title: string, room: string | null) {
  const separator = " - ";
  const parts = title.split(separator).map((part) => part.trim());

  if (room && parts.length >= 3) {
    const roomIndex = parts.findIndex((part) => part.toLowerCase() === room.toLowerCase());
    if (roomIndex > 0) {
      return {
        partyLabel: parts[0],
        customerName: parts.slice(roomIndex + 1).join(separator),
      };
    }
  }

  const dashIndex = title.indexOf(separator);
  if (dashIndex === -1) {
    return null;
  }

  return {
    partyLabel: title.slice(0, dashIndex).trim(),
    customerName: title.slice(dashIndex + separator.length).trim(),
  };
}

function buildEventSummary(title: string, description: string): string {
  const room = extractRoom(title, description);
  const parsed = parseTitleParts(title, room);
  if (!parsed || !parsed.customerName) {
    return title;
  }

  const { partyLabel, customerName } = parsed;
  const roomLabel = room ? formatRoomForSummary(room) : null;

  if (/private/i.test(partyLabel)) {
    return `Private Party - ${customerName}`;
  }
  if (/public/i.test(partyLabel)) {
    if (roomLabel) {
      return `Public Party - Room ${roomLabel} - ${customerName}`;
    }
    return `Public Party - ${customerName}`;
  }

  if (roomLabel) {
    return `${partyLabel} - Room ${roomLabel} - ${customerName}`;
  }

  return `${partyLabel} - ${customerName}`;
}

function extractErrorStatus(error: unknown): number | string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  return (
    (error as { code?: unknown; response?: { status?: unknown } }).response?.status ??
    (error as { code?: unknown }).code
  ) as number | string | undefined;
}

function buildCalendarEventRequestBody(input: {
  title: string;
  description: string;
  start: string;
  end: string;
  eventId?: string;
}) {
  return {
    id: input.eventId,
    summary: buildEventSummary(input.title, input.description),
    description: input.description,
    start: {
      dateTime: input.start,
      timeZone: "America/New_York",
    },
    end: {
      dateTime: input.end,
      timeZone: "America/New_York",
    },
  };
}

export async function createGoogleCalendarEvent(input: {
  title: string;
  description: string;
  start: string;
  end: string;
  calendarId?: string;
  idempotencyKey?: string;
}) {
  const calendar = createCalendarClient();

  const calendarId =
    input.calendarId?.trim() || process.env.GOOGLE_CALENDAR_ID || "primary";

  const deterministicEventId = input.idempotencyKey
    ? createHash("sha256").update(input.idempotencyKey).digest("hex")
    : undefined;
  const requestBody = buildCalendarEventRequestBody({
    title: input.title,
    description: input.description,
    start: input.start,
    end: input.end,
    eventId: deterministicEventId,
  });

  try {
    const event = await calendar.events.insert({ calendarId, requestBody });
    return event.data.id;
  } catch (error) {
    const status = extractErrorStatus(error);
    if (deterministicEventId && status === 409) {
      const existing = await calendar.events.get({
        calendarId,
        eventId: deterministicEventId,
      });
      return existing.data.id ?? deterministicEventId;
    }
    throw error;
  }
}

/**
 * Updates an existing Google Calendar event in place (events.patch).
 * Returns null when the event no longer exists (404/410) so callers can
 * decide whether to recreate it; throws on other failures.
 */
export async function updateGoogleCalendarEvent(input: {
  eventId: string;
  title: string;
  description: string;
  start: string;
  end: string;
  calendarId?: string;
}): Promise<string | null> {
  const calendar = createCalendarClient();
  const calendarId =
    input.calendarId?.trim() || process.env.GOOGLE_CALENDAR_ID || "primary";
  const requestBody = buildCalendarEventRequestBody({
    title: input.title,
    description: input.description,
    start: input.start,
    end: input.end,
  });

  try {
    const event = await calendar.events.patch({
      calendarId,
      eventId: input.eventId,
      requestBody,
    });
    return event.data.id ?? input.eventId;
  } catch (error) {
    const status = extractErrorStatus(error);
    if (status === 404 || status === 410) {
      return null;
    }
    throw error;
  }
}

/**
 * Deletes a Google Calendar event. A missing event (404/410) is treated as
 * a successful delete since the desired end state (no event) is achieved.
 */
export async function deleteGoogleCalendarEvent(input: {
  eventId: string;
  calendarId?: string;
}): Promise<boolean> {
  const calendarId =
    input.calendarId?.trim() || process.env.GOOGLE_CALENDAR_ID || "primary";

  try {
    const calendar = createCalendarClient();
    await calendar.events.delete({ calendarId, eventId: input.eventId });
    return true;
  } catch (error) {
    const status = extractErrorStatus(error);
    if (status === 404 || status === 410) {
      return true;
    }
    console.error(
      "[google-calendar] event delete failed",
      summarizeGoogleCalendarError(error),
    );
    return false;
  }
}

/**
 * Reads the configured calendar destinations. The primary destination
 * always has a value (falls back to "primary"); the secondary destination
 * is only present when GOOGLE_CALENDAR_SECONDARY_ID is configured.
 */
export type GoogleCalendarDestinations = {
  primary: string;
  secondary: string | null;
};

export function getGoogleCalendarDestinations(): GoogleCalendarDestinations {
  const primary = process.env.GOOGLE_CALENDAR_ID?.trim() || "primary";
  const secondaryRaw = process.env.GOOGLE_CALENDAR_SECONDARY_ID?.trim() || null;
  const secondary =
    secondaryRaw && secondaryRaw.toLowerCase() !== primary.toLowerCase()
      ? secondaryRaw
      : null;
  return { primary, secondary };
}

export type GoogleCalendarSyncStatus =
  | "created"
  | "updated"
  | "already_exists"
  | "skipped"
  | "failed";

type SingleDestinationSyncResult = {
  eventId: string | null;
  status: GoogleCalendarSyncStatus;
};

async function createEventWithStatus(input: {
  title: string;
  description: string;
  start: string;
  end: string;
  calendarId: string;
  idempotencyKey: string;
}): Promise<SingleDestinationSyncResult> {
  const calendar = createCalendarClient();
  const deterministicEventId = createHash("sha256")
    .update(input.idempotencyKey)
    .digest("hex");
  const requestBody = buildCalendarEventRequestBody({
    title: input.title,
    description: input.description,
    start: input.start,
    end: input.end,
    eventId: deterministicEventId,
  });

  try {
    const event = await calendar.events.insert({
      calendarId: input.calendarId,
      requestBody,
    });
    return { eventId: event.data.id ?? deterministicEventId, status: "created" };
  } catch (error) {
    const status = extractErrorStatus(error);
    if (status === 409) {
      try {
        const existing = await calendar.events.get({
          calendarId: input.calendarId,
          eventId: deterministicEventId,
        });
        return {
          eventId: existing.data.id ?? deterministicEventId,
          status: "already_exists",
        };
      } catch (getError) {
        console.error(
          "[google-calendar] destination fetch-after-409 failed",
          summarizeGoogleCalendarError(getError),
        );
        return { eventId: null, status: "failed" };
      }
    }
    console.error(
      "[google-calendar] destination create failed",
      summarizeGoogleCalendarError(error),
    );
    return { eventId: null, status: "failed" };
  }
}

export type GoogleCalendarSyncAction = "update" | "create";

/**
 * Pure decision logic for a single destination: when an event id is already
 * known, update it in place instead of creating a second event (avoids
 * duplicates); otherwise create it. Kept separate from I/O so it can be unit
 * tested without a live Google Calendar connection.
 */
export function decideGoogleCalendarSyncAction(
  existingEventId: string | null | undefined,
): GoogleCalendarSyncAction {
  return existingEventId ? "update" : "create";
}

async function syncSingleCalendarDestination(input: {
  calendarId: string;
  eventId: string | null;
  idempotencyKey: string;
  title: string;
  description: string;
  start: string;
  end: string;
}): Promise<SingleDestinationSyncResult> {
  if (decideGoogleCalendarSyncAction(input.eventId) === "update" && input.eventId) {
    try {
      const updatedId = await updateGoogleCalendarEvent({
        eventId: input.eventId,
        title: input.title,
        description: input.description,
        start: input.start,
        end: input.end,
        calendarId: input.calendarId,
      });
      if (updatedId) {
        return { eventId: updatedId, status: "updated" };
      }
      // Event no longer exists on the calendar (404/410); fall through and
      // recreate it deterministically below.
    } catch (error) {
      console.error(
        "[google-calendar] destination update failed",
        summarizeGoogleCalendarError(error),
      );
      return { eventId: input.eventId, status: "failed" };
    }
  }

  return createEventWithStatus({
    title: input.title,
    description: input.description,
    start: input.start,
    end: input.end,
    calendarId: input.calendarId,
    idempotencyKey: input.idempotencyKey,
  });
}

export type GoogleCalendarSyncResult = {
  primaryEventId: string | null;
  secondaryEventId: string | null;
  primaryStatus: GoogleCalendarSyncStatus;
  secondaryStatus: GoogleCalendarSyncStatus;
};

export type GoogleCalendarProjectionEvaluation = {
  /** Primary destination failed — booking calendar projection is incomplete. */
  primaryFailed: boolean;
  /**
   * Secondary destination failed while primary succeeded.
   * Operational facility/rental calendars remain usable; secondary is degraded.
   */
  secondaryDegraded: boolean;
  /** True only when the primary calendar projection did not succeed. */
  hardFailed: boolean;
  primaryEventId: string | null;
  secondaryEventId: string | null;
};

/**
 * Interprets a multi-destination sync result for workflow / alert decisions.
 * A secondary-only failure must not erase or hide a successful primary event.
 */
export function evaluateGoogleCalendarProjection(
  sync: GoogleCalendarSyncResult,
): GoogleCalendarProjectionEvaluation {
  const primaryFailed = sync.primaryStatus === "failed";
  const secondaryDegraded =
    !primaryFailed && sync.secondaryStatus === "failed";
  return {
    primaryFailed,
    secondaryDegraded,
    hardFailed: primaryFailed,
    primaryEventId: sync.primaryEventId,
    secondaryEventId: sync.secondaryEventId,
  };
}

/**
 * Syncs an event across the primary calendar destination and, when
 * configured, a secondary calendar destination (e.g. a calendar shared by
 * another team member). Each destination is synced independently: a
 * secondary failure never overwrites or hides the primary result, and vice
 * versa. When an event id is already known for a destination it is updated
 * in place (events.patch) rather than skipped, so downstream edits to the
 * booking keep both calendars current.
 */
export async function syncGoogleCalendarDestinations(input: {
  title: string;
  description: string;
  start: string;
  end: string;
  idempotencyKeyBase: string;
  primaryEventId?: string | null;
  secondaryEventId?: string | null;
  primaryCalendarId?: string;
}): Promise<GoogleCalendarSyncResult> {
  const destinations = getGoogleCalendarDestinations();
  const primaryCalendarId =
    input.primaryCalendarId?.trim() || destinations.primary;

  const primary = await syncSingleCalendarDestination({
    calendarId: primaryCalendarId,
    eventId: input.primaryEventId ?? null,
    idempotencyKey: input.idempotencyKeyBase,
    title: input.title,
    description: input.description,
    start: input.start,
    end: input.end,
  });

  if (!destinations.secondary) {
    return {
      primaryEventId: primary.eventId,
      secondaryEventId: input.secondaryEventId ?? null,
      primaryStatus: primary.status,
      secondaryStatus: "skipped",
    };
  }

  const secondary = await syncSingleCalendarDestination({
    calendarId: destinations.secondary,
    eventId: input.secondaryEventId ?? null,
    idempotencyKey: `${input.idempotencyKeyBase}-secondary`,
    title: input.title,
    description: input.description,
    start: input.start,
    end: input.end,
  });

  return {
    primaryEventId: primary.eventId,
    secondaryEventId: secondary.eventId,
    primaryStatus: primary.status,
    secondaryStatus: secondary.status,
  };
}

export type GoogleCalendarDeleteStatus = "deleted" | "skipped" | "failed";

export type GoogleCalendarDeleteResult = {
  primaryStatus: GoogleCalendarDeleteStatus;
  secondaryStatus: GoogleCalendarDeleteStatus;
};

async function deleteSingleDestination(
  calendarId: string,
  eventId: string | null,
): Promise<GoogleCalendarDeleteStatus> {
  if (!eventId) {
    return "skipped";
  }
  const deleted = await deleteGoogleCalendarEvent({ eventId, calendarId });
  return deleted ? "deleted" : "failed";
}

/**
 * Deletes an event from the primary destination and, when configured and a
 * secondary event id is known, the secondary destination. Each destination
 * is reported independently.
 */
export async function deleteGoogleCalendarDestinations(input: {
  primaryEventId?: string | null;
  secondaryEventId?: string | null;
  primaryCalendarId?: string;
}): Promise<GoogleCalendarDeleteResult> {
  const destinations = getGoogleCalendarDestinations();
  const primaryCalendarId =
    input.primaryCalendarId?.trim() || destinations.primary;

  const primaryStatus = await deleteSingleDestination(
    primaryCalendarId,
    input.primaryEventId ?? null,
  );
  const secondaryStatus = destinations.secondary
    ? await deleteSingleDestination(
        destinations.secondary,
        input.secondaryEventId ?? null,
      )
    : "skipped";

  return { primaryStatus, secondaryStatus };
}

export function summarizeGoogleCalendarError(error: unknown): {
  message: string;
  code?: string | number;
  status?: string | number;
} {
  if (!error || typeof error !== "object") {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const record = error as {
    message?: unknown;
    code?: unknown;
    status?: unknown;
    cause?: unknown;
    response?: { status?: unknown; statusText?: unknown; data?: unknown };
  };
  const responseData =
    record.response?.data && typeof record.response.data === "object"
      ? (record.response.data as { error?: unknown; error_description?: unknown })
      : null;
  const cause =
    record.cause && typeof record.cause === "object"
      ? (record.cause as { message?: unknown; code?: unknown; status?: unknown })
      : null;

  const rawMessage =
    typeof responseData?.error === "string"
      ? responseData.error
      : typeof cause?.message === "string"
        ? cause.message
        : typeof record.message === "string"
          ? record.message
          : "Google Calendar request failed";

  return {
    message: String(rawMessage)
      .replace(/ya29\.[A-Za-z0-9._\-]+/g, "[redacted_token]")
      .replace(/1\/\/[A-Za-z0-9_\-]+/g, "[redacted_refresh]")
      .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [redacted]")
      .slice(0, 240),
    code:
      typeof record.code === "string" || typeof record.code === "number"
        ? record.code
        : typeof cause?.code === "string" || typeof cause?.code === "number"
          ? cause.code
          : undefined,
    status:
      typeof record.status === "string" || typeof record.status === "number"
        ? record.status
        : typeof record.response?.status === "string" ||
            typeof record.response?.status === "number"
          ? record.response.status
          : typeof cause?.status === "string" || typeof cause?.status === "number"
            ? cause.status
            : undefined,
  };
}
