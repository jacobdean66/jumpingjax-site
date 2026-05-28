import { google } from "googleapis";

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
}) {
  const calendar = createCalendarClient();

  const calendarId =
    input.calendarId?.trim() || process.env.GOOGLE_CALENDAR_ID || "primary";

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
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
    },
  });

  return event.data.id;
}
