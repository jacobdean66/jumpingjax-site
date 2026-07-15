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
  const requestBody = {
      id: deterministicEventId,
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

  try {
    const event = await calendar.events.insert({ calendarId, requestBody });
    return event.data.id;
  } catch (error) {
    const status =
      error && typeof error === "object"
        ? (error as { code?: unknown; response?: { status?: unknown } }).response?.status ??
          (error as { code?: unknown }).code
        : undefined;
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

  return {
    message:
      typeof responseData?.error === "string"
        ? responseData.error
        : typeof cause?.message === "string"
          ? cause.message
          : typeof record.message === "string"
            ? record.message
            : "Google Calendar request failed",
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
