import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  parseScheduleEmailRecipients,
  sendScheduleEmail,
  type ScheduleEmailEvent,
} from "@/lib/admin/schedule-email";
import { verifyAdminAccess } from "@/lib/admin/session";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Body = {
  recipients?: unknown;
  dates?: unknown;
  heading?: unknown;
  events?: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asEvents(value: unknown): ScheduleEmailEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        id: typeof row.id === "string" ? row.id : "",
        type: typeof row.type === "string" ? row.type : "rental",
        date: typeof row.date === "string" ? row.date : "",
        customer: typeof row.customer === "string" ? row.customer : "Guest",
        phone: typeof row.phone === "string" ? row.phone : null,
        title: typeof row.title === "string" ? row.title : "",
        products: asStringArray(row.products),
        displayTime:
          typeof row.displayTime === "string" ? row.displayTime : "Time not set",
        location: typeof row.location === "string" ? row.location : null,
        room: typeof row.room === "string" ? row.room : null,
        status: typeof row.status === "string" ? row.status : "",
      } satisfies ScheduleEmailEvent;
    })
    .filter((item): item is ScheduleEmailEvent => Boolean(item?.id && item.date));
}

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    scope: "admin-schedule-email",
    limit: 20,
    windowMs: 60 * 1000,
  });
  if (limited) return limited;

  const auth = await verifyAdminAccess();
  if (!auth.ok) {
    return NextResponse.json(
      {
        error:
          auth.reason === "missing_config"
            ? "Admin login is not configured."
            : "Admin authentication required.",
      },
      { status: auth.reason === "missing_config" ? 503 : 401 },
    );
  }

  let body: Body | null = null;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const recipientsRaw =
    typeof body?.recipients === "string" ? body.recipients : "";
  const parsed = parseScheduleEmailRecipients(recipientsRaw);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const dates = asStringArray(body?.dates);
  const heading =
    typeof body?.heading === "string" && body.heading.trim()
      ? body.heading.trim()
      : "Schedule";
  const events = asEvents(body?.events);

  const idempotencyKey = createHash("sha256")
    .update(
      JSON.stringify({
        recipients: parsed.recipients,
        dates,
        heading,
        eventIds: events.map((event) => event.id).sort(),
      }),
    )
    .digest("hex")
    .slice(0, 48);

  const result = await sendScheduleEmail({
    recipients: parsed.recipients,
    dates,
    heading,
    events,
    idempotencyKey: `schedule-email-${idempotencyKey}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
