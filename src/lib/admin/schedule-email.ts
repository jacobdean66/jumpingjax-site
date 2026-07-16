import { Resend } from "resend";

import { getResendFromAddress } from "@/lib/email/resend";
import type { ScheduleEventType } from "@/lib/admin/schedule";

export type ScheduleEmailEvent = {
  id: string;
  type: ScheduleEventType | string;
  date: string;
  customer: string;
  phone: string | null;
  title: string;
  products: string[];
  displayTime: string;
  location: string | null;
  room: string | null;
  status: string;
};

function splitRecipients(value: string): string[] {
  return value
    .split(/[,\s;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseScheduleEmailRecipients(value: string): {
  recipients: string[];
  error: string | null;
} {
  const recipients = [...new Set(splitRecipients(value).map((email) => email.toLowerCase()))];
  if (recipients.length === 0) {
    return { recipients: [], error: "Enter at least one recipient email." };
  }
  const invalid = recipients.filter((email) => !isValidEmail(email));
  if (invalid.length > 0) {
    return {
      recipients: [],
      error: `Invalid email address: ${invalid[0]}`,
    };
  }
  return { recipients, error: null };
}

export function buildScheduleEmailSubject(dates: string[]): string {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return "Jumping Jax schedule";
  if (sorted.length === 1) return `Jumping Jax schedule — ${sorted[0]}`;
  if (sorted.length <= 4) {
    return `Jumping Jax schedule — ${sorted.join(", ")}`;
  }
  return `Jumping Jax schedule — ${sorted[0]} … ${sorted[sorted.length - 1]} (${sorted.length} dates)`;
}

export function buildScheduleEmailHtml(input: {
  heading: string;
  dates: string[];
  events: ScheduleEmailEvent[];
}): string {
  const byDate = new Map<string, ScheduleEmailEvent[]>();
  for (const date of [...input.dates].sort()) {
    byDate.set(date, []);
  }
  for (const event of input.events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  const sections = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => {
      const rows =
        events.length === 0
          ? "<p>No bookings</p>"
          : `<ul>${events
              .map((event) => {
                const products =
                  event.products.length > 0
                    ? event.products.join(", ")
                    : event.title;
                return `<li><strong>${escapeHtml(event.customer)}</strong> — ${escapeHtml(products)} — ${escapeHtml(event.displayTime)} — ${escapeHtml(event.status)}${event.phone ? ` — ${escapeHtml(event.phone)}` : ""}${event.location ? ` — ${escapeHtml(event.location)}` : ""}${event.room ? ` — ${escapeHtml(event.room)}` : ""}</li>`;
              })
              .join("")}</ul>`;
      return `<h2>${escapeHtml(date)}</h2>${rows}`;
    })
    .join("");

  return `<!doctype html><html><body>
    <h1>Jumping Jax Schedule</h1>
    <p>${escapeHtml(input.heading)}</p>
    <p>Dates: ${escapeHtml([...input.dates].sort().join(", "))}</p>
    ${sections}
  </body></html>`;
}

export function buildScheduleEmailText(input: {
  heading: string;
  dates: string[];
  events: ScheduleEmailEvent[];
}): string {
  const lines = [
    "Jumping Jax Schedule",
    input.heading,
    `Dates: ${[...input.dates].sort().join(", ")}`,
    "",
  ];
  const byDate = new Map<string, ScheduleEmailEvent[]>();
  for (const date of [...input.dates].sort()) byDate.set(date, []);
  for (const event of input.events) {
    byDate.set(event.date, [...(byDate.get(event.date) ?? []), event]);
  }
  for (const [date, events] of [...byDate.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    lines.push(`## ${date}`);
    if (events.length === 0) {
      lines.push("No bookings");
    } else {
      for (const event of events) {
        const products =
          event.products.length > 0 ? event.products.join(", ") : event.title;
        lines.push(
          `- ${event.customer} | ${products} | ${event.displayTime} | ${event.status}${event.phone ? ` | ${event.phone}` : ""}`,
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendScheduleEmail(input: {
  recipients: string[];
  dates: string[];
  heading: string;
  events: ScheduleEmailEvent[];
  idempotencyKey: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "Email is not configured (RESEND_API_KEY)." };
  }

  const resend = new Resend(apiKey);
  const subject = buildScheduleEmailSubject(input.dates);
  const { error } = await resend.emails.send(
    {
      from: getResendFromAddress(),
      to: input.recipients,
      subject,
      html: buildScheduleEmailHtml(input),
      text: buildScheduleEmailText(input),
    },
    { idempotencyKey: input.idempotencyKey },
  );

  if (error) {
    console.error("[schedule-email] send failed", {
      message: error.message,
    });
    return { ok: false, error: "Unable to send schedule email." };
  }
  return { ok: true };
}
