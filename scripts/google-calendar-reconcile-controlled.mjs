import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

const CONTROL_MARKER = "CONTROLLED END-TO-END TEST - SAFE TO DELETE";

function loadEnv(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
      }
      return env;
    }, {});
}

function requireEnv(env, key) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key} in .env.local`);
  }
  return value;
}

function formatResult(result) {
  return JSON.stringify(result, null, 2);
}

function calendarClient(env) {
  const auth = new google.auth.OAuth2(
    requireEnv(env, "GOOGLE_CLIENT_ID"),
    requireEnv(env, "GOOGLE_CLIENT_SECRET"),
  );
  auth.setCredentials({ refresh_token: requireEnv(env, "GOOGLE_REFRESH_TOKEN") });
  return google.calendar({ version: "v3", auth });
}

function supabaseClient(env) {
  return createClient(
    requireEnv(env, "NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

function requireControlledText(value, field) {
  if (!String(value ?? "").includes(CONTROL_MARKER)) {
    throw new Error(`Refusing to modify booking without marker in ${field}`);
  }
}

function dateTimeFromYmdAndTime(ymd, time, fallbackHour) {
  const [year, month, day] = String(ymd).slice(0, 10).split("-").map(Number);
  const match = String(time ?? "").match(/^(\d{1,2}):(\d{2})/);
  const hour = match ? Number(match[1]) : fallbackHour;
  const minute = match ? Number(match[2]) : 0;
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

async function reconcileRental(env, id) {
  const supabase = supabaseClient(env);
  const calendar = calendarClient(env);
  const calendarId = requireEnv(env, "GOOGLE_CALENDAR_ID");
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id,status,customer_name,customer_email,customer_phone,rental_item,rental_name,event_date,event_start_time,requested_delivery_window,event_address,setup_notes,google_calendar_event_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!booking) throw new Error("Rental booking not found");
  requireControlledText(booking.setup_notes, "setup_notes");
  if (booking.status !== "approved") {
    throw new Error(`Rental must be approved; found ${booking.status}`);
  }
  if (booking.google_calendar_event_id) {
    return { type: "rental", id, action: "skipped_duplicate", eventExists: true };
  }

  const start = dateTimeFromYmdAndTime(
    booking.event_date,
    booking.event_start_time,
    13,
  );
  const end = new Date(new Date(start).getTime() + 90 * 60_000).toISOString();
  const insert = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `Rental - ${booking.rental_name ?? booking.rental_item} - ${booking.customer_name}`,
      description: [
        `Controlled test booking: ${booking.id}`,
        `Customer: ${booking.customer_name}`,
        booking.customer_email ? `Email: ${booking.customer_email}` : null,
        booking.customer_phone ? `Phone: ${booking.customer_phone}` : null,
        booking.event_address ? `Address: ${booking.event_address}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start: { dateTime: start, timeZone: "America/New_York" },
      end: { dateTime: end, timeZone: "America/New_York" },
    },
  });

  const eventId = insert.data.id;
  if (!eventId) throw new Error("Google did not return an event id");
  const save = await supabase
    .from("bookings")
    .update({ google_calendar_event_id: eventId })
    .eq("id", id)
    .is("google_calendar_event_id", null)
    .select("google_calendar_event_id")
    .maybeSingle();
  if (save.error) throw new Error(save.error.message);
  if (!save.data?.google_calendar_event_id) {
    throw new Error("Duplicate guard blocked saving event id");
  }
  await calendar.events.get({ calendarId, eventId });
  return { type: "rental", id, action: "created", eventPersisted: true };
}

async function reconcileFacility(env, id) {
  const supabase = supabaseClient(env);
  const calendar = calendarClient(env);
  const calendarId =
    env.GOOGLE_FACILITY_CALENDAR_ID?.trim() ||
    requireEnv(env, "GOOGLE_CALENDAR_ID");
  const { data: booking, error } = await supabase
    .from("facility_bookings")
    .select(
      "id,status,customer_name,email,phone,party_label,start_time,end_time,notes,google_calendar_event_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!booking) throw new Error("Facility booking not found");
  requireControlledText(booking.notes, "notes");
  if (booking.status !== "confirmed") {
    throw new Error(`Facility booking must be confirmed; found ${booking.status}`);
  }
  if (booking.google_calendar_event_id) {
    return { type: "facility", id, action: "skipped_duplicate", eventExists: true };
  }

  const insert = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `${booking.party_label ?? "Facility Party"} - ${booking.customer_name}`,
      description: [
        `Controlled test booking: ${booking.id}`,
        `Customer: ${booking.customer_name}`,
        booking.email ? `Email: ${booking.email}` : null,
        booking.phone ? `Phone: ${booking.phone}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start: { dateTime: booking.start_time, timeZone: "America/New_York" },
      end: { dateTime: booking.end_time, timeZone: "America/New_York" },
    },
  });

  const eventId = insert.data.id;
  if (!eventId) throw new Error("Google did not return an event id");
  const save = await supabase
    .from("facility_bookings")
    .update({ google_calendar_event_id: eventId })
    .eq("id", id)
    .is("google_calendar_event_id", null)
    .select("google_calendar_event_id")
    .maybeSingle();
  if (save.error) throw new Error(save.error.message);
  if (!save.data?.google_calendar_event_id) {
    throw new Error("Duplicate guard blocked saving event id");
  }
  await calendar.events.get({ calendarId, eventId });
  return { type: "facility", id, action: "created", eventPersisted: true };
}

async function main() {
  const [, , type, id] = process.argv;
  if ((type !== "rental" && type !== "facility") || !id) {
    throw new Error(
      "Usage: node scripts/google-calendar-reconcile-controlled.mjs <rental|facility> <id>",
    );
  }
  const env = loadEnv(".env.local");
  const result =
    type === "rental"
      ? await reconcileRental(env, id)
      : await reconcileFacility(env, id);
  console.log(formatResult(result));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
