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

export async function createGoogleCalendarEvent(input: {
  title: string;
  description: string;
  start: string;
  end: string;
}) {
  const calendar = createCalendarClient();

  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: input.title,
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
